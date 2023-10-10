defmodule ColoringBookWeb.AuthLive.Index do
  use ColoringBookWeb, :live_view

  alias ColoringBook.Accounts
  alias ColoringBook.Accounts.User
  alias AshPhoenix.Form

  @impl true
  def mount(_, _, socket) do
    {:ok, socket}
  end

  @impl true
  def handle_params(params, _url, socket) do
    {:noreply, apply_action(socket, socket.assigns.live_action, params)}
  end

  defp apply_action(socket, :register, _params) do
    socket
    |> assign(:form_id, "sign-up-form")
    |> assign(:cta, "Sign up")
    |> assign(:alternative_path, ~p"/sign-in")
    |> assign(:alternative, "Login with existing account")
    |> assign(:action, ~p"/auth/user/password/register")
    |> assign(
      :form,
      Form.for_create(User, :register_with_password, api: Accounts, as: "user")
    )
  end

  defp apply_action(socket, :sign_in, _params) do
    socket
    |> assign(:form_id, "sign-in-form")
    |> assign(:cta, "Login")
    |> assign(:alternative_path, ~p"/register")
    |> assign(:alternative, "Create an account")
    |> assign(:action, ~p"/auth/user/password/sign_in")
    |> assign(
      :form,
      Form.for_action(User, :sign_in_with_password, api: Accounts, as: "user")
    )
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="w-full h-[100vh] flex items-center justify-center">
      <div class="bg-neutral-900 w-80 p-8 rounded-md mx-auto text-center">
        <h1 class="text-4xl text-white font-black"><%= @cta %></h1>
        <p class="text-white mb-4">
          <a href={@alternative_path} class="underline"><%= @alternative %></a>
        </p>

        <.live_component
          module={ColoringBookWeb.AuthLive.AuthForm}
          id={@form_id}
          form={@form}
          is_register?={@live_action == :register}
          action={@action}
          cta={@cta}
        />
      </div>
    </div>
    """
  end
end
