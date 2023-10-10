defmodule ColoringBook.Accounts.User do
  use Ash.Resource,
    data_layer: AshPostgres.DataLayer,
    extensions: [AshAuthentication]

  attributes do
    uuid_primary_key :id
    attribute :username, :ci_string, allow_nil?: false
    attribute :hashed_password, :string, allow_nil?: false, sensitive?: true
  end

  authentication do
    api ColoringBook.Accounts

    strategies do
      password :password do
        identity_field :username
        confirmation_required? false
        sign_in_tokens_enabled? false
      end
    end
  end

  postgres do
    table "users"
    repo ColoringBook.Repo
  end

  identities do
    identity :unique_username, [:username]
  end
end
