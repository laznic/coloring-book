defmodule ColoringBook.Canvases.Generation do
  use Ash.Resource,
    data_layer: AshPostgres.DataLayer

  postgres do
    table "generations"
    repo ColoringBook.Repo
  end

  code_interface do
    define_for ColoringBook.Canvases

    define :create, action: :create
    define :read, action: :read
    define :update, action: :update
    define :get_by_id, action: :read, get_by: [:id], get?: true
  end

  actions do
    defaults [:read, :create, :update]
  end

  attributes do
    uuid_primary_key :id
    attribute :prompt, :string, allow_nil?: false
    attribute :top, :integer, allow_nil?: false
    attribute :left, :integer, allow_nil?: false
    attribute :image_url, :string, allow_nil?: true

    create_timestamp :created_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :canvas, ColoringBook.Canvases.Canvas do
      attribute_writable? true
    end
  end
end
