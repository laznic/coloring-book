defmodule ColoringBook.Accounts do
  use Ash.Api

  resources do
    resource ColoringBook.Accounts.User
  end
end
