import os
from typing import TypedDict, List, Literal, Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage

from database import (
    add_transaction,
    get_budget_status,
    get_monthly_summary,
    set_budget_limit
)

load_dotenv()

llm = ChatGoogleGenerativeAI(
    model="gemini-3.1-flash-lite",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0.2
)

# --- 1. DEFINISI STATE BERSAMA ---
class DompetkuState(TypedDict):
    user_input: str
    image_data: Optional[dict]  # Menyimpan {"mime_type": str, "b64": str} jika ada gambar
    user_id: str  # Supabase user ID — didapat dari tabel discord_links
    has_budget_change: bool
    has_new_transaction: bool
    updated_budgets: List[dict]
    extracted_transactions: List[dict]
    budget_alerts: List[str]
    final_response: str

# --- 2. SKEMA OUTPUT TERSTRUKTUR (PYDANTIC) ---
class RouteDecision(BaseModel):
    has_budget_change: bool = Field(
        description="True jika user meminta perubahan/pengaturan limit budget pada kategori tertentu."
    )
    has_new_transaction: bool = Field(
        description="True jika user melaporkan pengeluaran/pemasukan baru atau melampirkan gambar struk/bukti bayar."
    )

class BudgetUpdateItem(BaseModel):
    category: Literal["makanan", "transportasi", "hiburan", "tagihan", "lainnya"] = Field(
        description="Kategori budget yang ingin diubah limitnya"
    )
    new_limit: int = Field(
        description="Nominal limit bulanan baru dalam angka utuh (contoh: 1.5jt menjadi 1500000)"
    )

class BudgetUpdateList(BaseModel):
    items: List[BudgetUpdateItem] = Field(description="Daftar perubahan limit budget")

class TransactionItem(BaseModel):
    type: Literal["income", "expense"] = Field(description="income atau expense")
    category: Literal["makanan", "transportasi", "hiburan", "tagihan", "lainnya"] = Field(
        description="Kategori transaksi"
    )
    amount: int = Field(description="Nominal uang dalam angka bulat")
    description: str = Field(description="Deskripsi singkat transaksi (sebutkan nama toko/item jika dari struk)")

class TransactionList(BaseModel):
    items: List[TransactionItem] = Field(description="Daftar transaksi baru")

# --- HELPER UNTUK PESAN MULTIMODAL (TEKS + GAMBAR) ---
def build_multimodal_message(state: DompetkuState, default_prompt: str) -> HumanMessage:
    content_parts = []
    text_input = state.get("user_input", "").strip()
    
    if text_input:
        content_parts.append({"type": "text", "text": text_input})
    else:
        content_parts.append({"type": "text", "text": default_prompt})
        
    img = state.get("image_data")
    if img and img.get("b64"):
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": f"data:{img['mime_type']};base64,{img['b64']}"}
        })
        
    return HumanMessage(content=content_parts)

# --- 3. NODE AGEN ---

def supervisor_node(state: DompetkuState) -> DompetkuState:
    """Agen Koordinator: Mendeteksi aksi dari teks maupun gambar."""
    has_image = bool(state.get("image_data"))
    text_input = state.get("user_input", "").strip()
    
    # Jika user hanya kirim gambar tanpa caption, otomatis anggap catat transaksi struk
    if has_image and not text_input:
        return {
            "has_budget_change": False,
            "has_new_transaction": True
        }
        
    structured_llm = llm.with_structured_output(RouteDecision)
    system_prompt = (
        "Analisis pesan user untuk aplikasi keuangan Dompetku:\n"
        "1. Set 'has_budget_change' = True jika user ingin mengatur, mengubah, menaikkan, atau menurunkan limit/jatah budget.\n"
        "2. Set 'has_new_transaction' = True jika user mencatat pembelian/pengeluaran/pemasukan baru ATAU melampirkan foto struk/bukti transaksi.\n"
        "Catatan: Keduanya bisa bernilai True bersamaan atau False bersamaan."
    )
    
    msg = build_multimodal_message(state, "Cek gambar struk ini.")
    decision = structured_llm.invoke([
        SystemMessage(content=system_prompt),
        msg
    ])
    
    return {
        "has_budget_change": decision.has_budget_change,
        "has_new_transaction": decision.has_new_transaction or has_image
    }

def budget_manager_node(state: DompetkuState) -> DompetkuState:
    """Agen Pengatur Budget: Mengubah limit kategori di Supabase dari perintah chat."""
    structured_llm = llm.with_structured_output(BudgetUpdateList)
    system_prompt = (
        "Ekstrak kategori dan nominal limit budget baru yang diinginkan user. "
        "Jangan masukkan transaksi belanja harian atau isi struk ke sini, hanya perubahan limit/jatah bulanan."
    )
    result = structured_llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=state["user_input"])
    ])
    
    updated = []
    for item in result.items:
        new_status = set_budget_limit(state["user_id"], item.category, item.new_limit)
        updated.append(new_status)
        
    return {"updated_budgets": updated}

def parser_node(state: DompetkuState) -> DompetkuState:
    """Agen Pencatat & OCR: Mengekstrak transaksi dari teks maupun foto struk ke Supabase."""
    structured_llm = llm.with_structured_output(TransactionList)
    system_prompt = (
        "Ekstrak semua transaksi pemasukan/pengeluaran dari pesan teks maupun gambar struk/bukti bayar.\n"
        "- Jika ada gambar struk belanja/restoran/minimarket/bukti transfer: secara default catat TOTAL AKHIR (Grand Total) "
        "sebagai 1 transaksi utuh dan cantumkan nama merchant/ringkasan barang di 'description', KECUALI jika di teks caption "
        "user secara spesifik meminta dipecah per item.\n"
        "- Abaikan kalimat yang hanya membahas pengubahan limit budget bulanan.\n"
        "- Konversi singkatan seperti 'rb', 'k', 'jt' atau format ribuan struk (misal 25.000 / 25,000) menjadi angka bulat (25000).\n"
        "- Jika pemasukan (gaji, transfer masuk), set type='income' dan category='lainnya'."
    )
    
    msg = build_multimodal_message(
        state, 
        "Tolong baca foto struk/bukti pembayaran ini dan ekstrak transaksinya."
    )
    result = structured_llm.invoke([
        SystemMessage(content=system_prompt),
        msg
    ])
    
    saved_items = []
    for item in result.items:
        tx_id = add_transaction(state["user_id"], item.type, item.category, item.amount, item.description)
        saved_items.append({
            "id": tx_id,
            "type": item.type,
            "category": item.category,
            "amount": item.amount,
            "description": item.description
        })
        
    return {"extracted_transactions": saved_items}

def budget_guard_node(state: DompetkuState) -> DompetkuState:
    """Agen Pengawas: Mengecek pemakaian budget dari transaksi yang baru dicatat."""
    alerts = []
    checked_categories = set()
    
    for tx in state.get("extracted_transactions", []):
        if tx["type"] == "expense" and tx["category"] not in checked_categories:
            cat = tx["category"]
            checked_categories.add(cat)
            status = get_budget_status(state["user_id"], cat)
            
            if status["usage_percent"] >= 100:
                alerts.append(
                    f"⚠️ OVERBUDGET [{cat.upper()}]: Terpakai Rp{status['spent']:,} dari limit Rp{status['limit']:,} ({status['usage_percent']}%)."
                )
            elif status["usage_percent"] >= 80:
                alerts.append(
                    f"⚠️ WARNING [{cat.upper()}]: Sudah menyentuh {status['usage_percent']}% (Sisa Rp{status['remaining']:,})."
                )
            else:
                alerts.append(
                    f"✅ AMAN [{cat.upper()}]: Terpakai {status['usage_percent']}% (Sisa Rp{status['remaining']:,} dari Rp{status['limit']:,})."
                )
                
    return {"budget_alerts": alerts}

def advisor_node(state: DompetkuState) -> DompetkuState:
    """Agen Konsultan: Menyusun respons akhir ke user."""
    summary = get_monthly_summary(state["user_id"])
    all_categories = ["makanan", "transportasi", "hiburan", "tagihan", "lainnya"]
    detailed_budgets = [get_budget_status(state["user_id"], c) for c in all_categories]
    
    user_label = state["user_input"] if state.get("user_input") else "[Mengirim Foto Struk/Bukti Bayar]"
    
    context = (
        f"Pesan User: {user_label}\n"
        f"Limit Budget Diperbarui: {state.get('updated_budgets', [])}\n"
        f"Transaksi Baru Dicatat: {state.get('extracted_transactions', [])}\n"
        f"Notifikasi Budget Guard: {state.get('budget_alerts', [])}\n"
        f"Ringkasan Bulan Ini: {summary}\n"
        f"Detail Limit Semua Kategori: {detailed_budgets}\n"
    )
    
    system_prompt = (
        "Kamu adalah asisten AI Dompetku. Jawab dengan ringkas, ramah, dan terformat rapi:\n"
        "1. Jika ada Limit Budget Diperbarui, konfirmasi limit baru beserta sisa saldonya saat ini.\n"
        "2. Jika ada Transaksi Baru Dicatat (baik dari chat maupun hasil baca struk), sebutkan detailnya dan lampirkan status dari Budget Guard.\n"
        "3. Jawab pertanyaan atau permintaan evaluasi user berdasarkan data yang tersedia."
    )
    
    response = llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=context)
    ])
    
    # Pastikan output berupa string bersih (bukan list JSON)
    content = response.content
    if isinstance(content, list):
        final_text = "".join([item.get("text", "") for item in content if isinstance(item, dict)])
    else:
        final_text = str(content)
        
    return {"final_response": final_text}