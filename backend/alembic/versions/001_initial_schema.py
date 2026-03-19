"""initial schema

Revision ID: 001
Revises: None
Create Date: 2026-03-16
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    try:
        # Enable TimescaleDB extension
        op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE")
        # Convert to TimescaleDB hypertable
        op.execute(
            "SELECT create_hypertable('wait_time_observations', 'observed_at', "
            "migrate_data => true, if_not_exists => true)"
        )
    except Exception as e:
        pass  

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

    # Wait Time Observations (will become hypertable)
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

    # User Preferences
    op.create_table(
        "user_preferences",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("device_id", sa.String(200), unique=True, nullable=False),
        sa.Column("language", sa.String(5), server_default="en"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Favorites
    op.create_table(
        "favorites",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("user_preferences.id"), nullable=False),
        sa.Column("port_id", sa.Integer(), sa.ForeignKey("ports_of_entry.id"), nullable=False),
        sa.Column("lane_type_id", sa.Integer(), sa.ForeignKey("lane_types.id"), nullable=True),
        sa.Column("sort_order", sa.SmallInteger(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "port_id", "lane_type_id"),
    )

    # Alert Subscriptions
    op.create_table(
        "alert_subscriptions",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("user_preferences.id"), nullable=False),
        sa.Column("port_id", sa.Integer(), sa.ForeignKey("ports_of_entry.id"), nullable=False),
        sa.Column("lane_type_id", sa.Integer(), sa.ForeignKey("lane_types.id"), nullable=True),
        sa.Column("threshold_min", sa.Integer(), nullable=False),
        sa.Column("direction", sa.String(10), server_default="above"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("alert_subscriptions")
    op.drop_table("favorites")
    op.drop_table("user_preferences")
    op.drop_table("predictions")
    op.drop_table("wait_time_observations")
    op.drop_table("lane_types")
    op.drop_table("ports_of_entry")
