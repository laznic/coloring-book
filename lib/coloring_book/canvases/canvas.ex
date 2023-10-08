defmodule ColoringBook.Canvases.Canvas do
  use Ash.Resource,
    data_layer: AshPostgres.DataLayer

  postgres do
    table "canvases"
    repo ColoringBook.Repo
  end

  code_interface do
    define_for ColoringBook.Canvases

    define :create, action: :create
    define :read, action: :read
    define :get_by_id, action: :read, get_by: [:id], get?: true
  end

  actions do
    defaults [:read, :create]
  end

  attributes do
    uuid_primary_key :id

    create_timestamp :created_at
    update_timestamp :updated_at
  end
end
