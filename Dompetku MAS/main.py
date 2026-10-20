from typing import Optional
from langgraph.graph import StateGraph, START, END
from database import init_db
from agents import (
    DompetkuState,
    supervisor_node,
    budget_manager_node,
    parser_node,
    budget_guard_node,
    advisor_node
)

def route_after_supervisor(state: DompetkuState):
    if state.get("has_budget_change"):
        return "budget_manager"
    if state.get("has_new_transaction"):
        return "parser"
    return "advisor"

def route_after_budget_manager(state: DompetkuState):
    if state.get("has_new_transaction"):
        return "parser"
    return "advisor"

def build_graph():
    workflow = StateGraph(DompetkuState)
    
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("budget_manager", budget_manager_node)
    workflow.add_node("parser", parser_node)
    workflow.add_node("budget_guard", budget_guard_node)
    workflow.add_node("advisor", advisor_node)
    
    workflow.add_edge(START, "supervisor")
    
    workflow.add_conditional_edges(
        "supervisor",
        route_after_supervisor,
        {
            "budget_manager": "budget_manager",
            "parser": "parser",
            "advisor": "advisor"
        }
    )
    
    workflow.add_conditional_edges(
        "budget_manager",
        route_after_budget_manager,
        {
            "parser": "parser",
            "advisor": "advisor"
        }
    )
    
    workflow.add_edge("parser", "budget_guard")
    workflow.add_edge("budget_guard", "advisor")
    workflow.add_edge("advisor", END)
    
    return workflow.compile()

# Inisialisasi DB dan Graph secara global agar siap dipanggil Bot/CLI
init_db()
dompetku_app = build_graph()

def process_message(user_text: str, user_id: str, image_data: Optional[dict] = None) -> str:
    """Fungsi utama untuk memproses chat (teks & gambar struk) dari CLI atau Discord."""
    initial_state = {
        "user_input": user_text or "",
        "image_data": image_data,
        "user_id": user_id,
        "has_budget_change": False,
        "has_new_transaction": False,
        "updated_budgets": [],
        "extracted_transactions": [],
        "budget_alerts": [],
        "final_response": ""
    }
    result = dompetku_app.invoke(initial_state)
    return result["final_response"]

if __name__ == "__main__":
    print("==================================================")
    print("💸 DOMPETKU MULTI-AGENT CLI (Ketik 'exit' untuk keluar)")
    print("==================================================")
    print("⚠️  CLI mode memerlukan user_id. Masukkan UUID user Supabase:")
    cli_user_id = input("User ID: ").strip()
    if not cli_user_id:
        print("User ID tidak boleh kosong!")
        exit(1)
    while True:
        text = input("\nKamu: ").strip()
        if text.lower() in ["exit", "quit", "keluar"]:
            print("Sampai jumpa! Jangan lupa jaga cashflow ya.")
            break
        if text:
            reply = process_message(text, cli_user_id)
            print(f"\nDompetku:\n{reply}")