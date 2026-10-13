import json
from sqlalchemy import select
from services.db_config import AsyncSessionLocal
from models.tables import User, OnboardingProgress


async def get_progress(user_id):
    async with AsyncSessionLocal() as session:
        progress = await session.get(OnboardingProgress, user_id)
        return json.loads(progress.completed_steps) if progress else []


async def complete_step(user_id, step_id, total):
    async with AsyncSessionLocal() as session:
        async with session.begin():
            # Serialize progress updates for this account on PostgreSQL.
            user = (await session.execute(select(User).where(User.id == user_id).with_for_update())).scalar_one()
            progress = await session.get(OnboardingProgress, user_id)
            if progress is None:
                progress = OnboardingProgress(user_id=user_id, completed_steps="[]")
                session.add(progress)
            steps = json.loads(progress.completed_steps)
            if step_id not in steps:
                steps.append(step_id)
            progress.completed_steps = json.dumps(steps)
            user.onboarding_completed = len(steps) >= total
        return steps


async def start_trial(user_id, trial_end):
    async with AsyncSessionLocal() as session:
        async with session.begin():
            user = await session.get(User, user_id)
            user.plan = "pro"
            user.trial_ends_at = trial_end
