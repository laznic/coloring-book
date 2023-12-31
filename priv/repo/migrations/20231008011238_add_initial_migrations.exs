defmodule ColoringBook.Repo.Migrations.AddInitialMigrations do
  @moduledoc """
  Updates resources based on their most recent snapshots.

  This file was autogenerated with `mix ash_postgres.generate_migrations`
  """

  use Ecto.Migration

  def up do
    create table(:generations, primary_key: false) do
      add :id, :uuid, null: false, primary_key: true
      add :prompt, :text, null: false
      add :top, :bigint, null: false
      add :left, :bigint, null: false
      add :image_url, :text
      add :created_at, :utc_datetime_usec, null: false, default: fragment("now()")
      add :updated_at, :utc_datetime_usec, null: false, default: fragment("now()")
      add :canvas_id, :uuid
    end

    create table(:canvases, primary_key: false) do
      add :id, :uuid, null: false, primary_key: true
    end

    alter table(:generations) do
      modify :canvas_id,
             references(:canvases,
               column: :id,
               name: "generations_canvas_id_fkey",
               type: :uuid,
               prefix: "public"
             )
    end

    alter table(:canvases) do
      add :created_at, :utc_datetime_usec, null: false, default: fragment("now()")
      add :updated_at, :utc_datetime_usec, null: false, default: fragment("now()")
    end
  end

  def down do
    alter table(:canvases) do
      remove :updated_at
      remove :created_at
    end

    drop constraint(:generations, "generations_canvas_id_fkey")

    alter table(:generations) do
      modify :canvas_id, :uuid
    end

    drop table(:canvases)

    drop table(:generations)
  end
end