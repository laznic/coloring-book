defmodule ColoringBook.Repo do
  use AshPostgres.Repo, otp_app: :coloring_book

  def installed_extensions do
    ["uuid-ossp", "citext"]
  end
end
