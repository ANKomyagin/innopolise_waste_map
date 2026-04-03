"""Initial migration: create containers table

Revision ID: 0c5b7630f966
Revises: 
Create Date: 2026-03-28 11:54:52.467917

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0c5b7630f966'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'containers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('address', sa.String(), nullable=True),
        sa.Column('coords', sa.String(), nullable=True),
        sa.Column('sensor_data', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_containers_id'), 'containers', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_containers_id'), table_name='containers')
    op.drop_table('containers')
