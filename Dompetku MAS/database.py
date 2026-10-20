import os
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

_client: Optional[Client] = None


def get_supabase() -> Client:
    """Singleton Supabase client (service role — bypasses RLS)."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError(
                "SUPABASE_URL dan SUPABASE_SERVICE_KEY harus diatur di environment variables!"
            )
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


def init_db():
    """Validasi koneksi Supabase. Tabel sudah ada di cloud — tidak perlu CREATE TABLE."""
    get_supabase()
    print("✅ Koneksi Supabase berhasil")


def get_user_id_from_discord(discord_id: str) -> Optional[str]:
    """Cari Supabase user_id dari Discord ID via tabel discord_links."""
    sb = get_supabase()
    result = (
        sb.table("discord_links")
        .select("user_id")
        .eq("discord_id", str(discord_id))
        .maybe_single()
        .execute()
    )
    if result.data:
        return result.data["user_id"]
    return None


# ── Mapping kategori bot → kategori web app ──────────────────────────────────
# Bot: makanan, transportasi, hiburan, tagihan, lainnya
# Web: Belanja, Makanan, Tagihan, Transportasi, Lainnya
_CATEGORY_MAP = {
    "makanan": "Makanan",
    "transportasi": "Transportasi",
    "hiburan": "Lainnya",
    "tagihan": "Tagihan",
    "lainnya": "Lainnya",
    "belanja": "Belanja",
}


def _map_category(bot_category: str) -> str:
    return _CATEGORY_MAP.get(bot_category.lower(), "Lainnya")


def add_transaction(
    user_id: str, tx_type: str, category: str, amount: int, description: str
) -> str:
    """Simpan transaksi ke Supabase, mengembalikan UUID transaksi."""
    sb = get_supabase()
    tx_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    row = {
        "id": tx_id,
        "user_id": user_id,
        "name": description,
        "category": _map_category(category),
        "date": today,
        "amount": abs(amount),
        "type": tx_type.lower(),
        "created_at": now,
    }

    sb.table("transactions").insert(row).execute()
    return tx_id


def get_budget_status(user_id: str, category: str) -> Dict[str, Any]:
    """Ambil status pemakaian budget bulan ini untuk kategori tertentu."""
    sb = get_supabase()
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    web_category = _map_category(category)

    # Total pengeluaran bulan ini untuk kategori ini
    result = (
        sb.table("transactions")
        .select("amount")
        .eq("user_id", user_id)
        .eq("type", "expense")
        .eq("category", web_category)
        .is_("deleted_at", "null")
        .gte("date", f"{current_month}-01")
        .lte("date", f"{current_month}-31")
        .execute()
    )

    spent = sum(row["amount"] for row in (result.data or []))

    # Ambil monthly_budget dari profile
    profile = (
        sb.table("profiles")
        .select("monthly_budget")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    total_budget = profile.data["monthly_budget"] if profile.data else 0
    # Budget per kategori = total / 5 (ada 5 kategori)
    limit_amt = total_budget // 5 if total_budget > 0 else 500000

    remaining = limit_amt - spent
    percentage = round((spent / limit_amt) * 100, 1) if limit_amt > 0 else 0

    return {
        "category": category.lower(),
        "spent": spent,
        "limit": limit_amt,
        "remaining": remaining,
        "usage_percent": percentage,
    }


def set_budget_limit(user_id: str, category: str, new_limit: int) -> Dict[str, Any]:
    """Update monthly_budget di profile (set total budget, bukan per kategori)."""
    sb = get_supabase()
    sb.table("profiles").update({"monthly_budget": new_limit}).eq(
        "id", user_id
    ).execute()
    return get_budget_status(user_id, category)


def get_monthly_summary(user_id: str) -> Dict[str, Any]:
    """Ringkasan pemasukan/pengeluaran bulan ini dari Supabase."""
    sb = get_supabase()
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")

    result = (
        sb.table("transactions")
        .select("type, category, amount")
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .gte("date", f"{current_month}-01")
        .lte("date", f"{current_month}-31")
        .execute()
    )

    total_income = 0
    total_expense = 0
    by_category: Dict[str, int] = {}

    for row in result.data or []:
        if row["type"] == "income":
            total_income += row["amount"]
        else:
            total_expense += row["amount"]
            cat = row["category"]
            by_category[cat] = by_category.get(cat, 0) + row["amount"]

    return {
        "month": current_month,
        "total_income": total_income,
        "total_expense": total_expense,
        "expenses_by_category": by_category,
    }
