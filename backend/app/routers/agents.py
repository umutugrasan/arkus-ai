from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user, get_db
from app.agents.orchestrator import (
    run_all_agents_for_user, get_agent_status, AGENT_PIPELINE,
)

router = APIRouter()



@router.get("/status")
def agents_status(user=Depends(get_current_user)):
    """Her ajanin son calisma zamani + tanimli ajanlar listesi."""
    return {
        "agents": get_agent_status(),
        "total_agents": len(AGENT_PIPELINE),
    }


@router.post("/run-all")
async def trigger_all_agents(user=Depends(get_current_user)):
    """Tum ajan pipeline'ini bu kullanici icin manuel tetikle (demo icin)."""
    result = await run_all_agents_for_user(user.id)
    return result


@router.post("/{agent_name}/run")
async def trigger_single_agent(
    agent_name: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Belirli bir ajani manuel tetikle (event flow olmadan)."""
    agent = next((a for a in AGENT_PIPELINE if a.name == agent_name), None)
    if not agent:
        valid = [a.name for a in AGENT_PIPELINE]
        raise HTTPException(
            status_code=404,
            detail=f"Bilinmeyen ajan '{agent_name}'. Gecerli: {valid}",
        )
    result = await agent.run(user.id, db)
    return result.to_dict()
