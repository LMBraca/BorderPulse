"""initial schema

Revision ID: 001
Revises: None
Create Date: 2026-03-16
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ports of Entry
    op.create_table(
        "ports_of_entry",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("cbp_port_id", sa.String(20), unique=True, nullable=False),
        sa.Column("name_en", sa.String(200), nullable=False),
        sa.Column("name_es", sa.String(200), nullable=False),
        sa.Column("city_us", sa.String(100)),
        sa.Column("city_mx", sa.String(100)),
        sa.Column("state_us", sa.String(50)),
        sa.Column("state_mx", sa.String(50)),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("crossing_type", sa.String(20), nullable=False, server_default="land"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("timezone", sa.String(50), nullable=False, server_default="America/Tijuana"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Lane Types
    op.create_table(
        "lane_types",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("code", sa.String(30), unique=True, nullable=False),
        sa.Column("name_en", sa.String(100), nullable=False),
        sa.Column("name_es", sa.String(100), nullable=False),
    )

    # Wait Time Observations
    op.create_table(
        "wait_time_observations",
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("port_id", sa.Integer(), sa.ForeignKey("ports_of_entry.id"), nullable=False),
        sa.Column("lane_type_id", sa.Integer(), sa.ForeignKey("lane_types.id"), nullable=False),
        sa.Column("wait_minutes", sa.Integer(), nullable=True),
        sa.Column("delay_minutes", sa.Integer(), nullable=True),
        sa.Column("lanes_open", sa.Integer(), nullable=True),
        sa.Column("is_closed", sa.Boolean(), server_default="false"),
        sa.Column("source", sa.String(30), server_default="cbp_api"),
        sa.Column("cbp_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ingested_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("observed_at", "port_id", "lane_type_id"),
    )

    op.create_index(
        "idx_wto_port_lane",
        "wait_time_observations",
        ["port_id", "lane_type_id", sa.text("observed_at DESC")],
    )

    # Predictions
    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("port_id", sa.Integer(), sa.ForeignKey("ports_of_entry.id"), nullable=False),
        sa.Column("lane_type_id", sa.Integer(), sa.ForeignKey("lane_types.id"), nullable=False),
        sa.Column("prediction_date", sa.Date(), nullable=False),
        sa.Column("hour", sa.SmallInteger(), nullable=False),
        sa.Column("predicted_wait", sa.Numeric(5, 1), nullable=False),
        sa.Column("confidence", sa.String(20), nullable=False),
        sa.Column("p25_wait", sa.Numeric(5, 1)),
        sa.Column("p75_wait", sa.Numeric(5, 1)),
        sa.Column("sample_count", sa.Integer()),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("port_id", "lane_type_id", "prediction_date", "hour"),
    )


def downgrade() -> None:
    op.drop_table("predictions")
    op.drop_table("wait_time_observations")
    op.drop_table("lane_types")
    op.drop_table("ports_of_entry")
