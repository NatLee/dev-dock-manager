from django.urls import path

from accounts import views

urlpatterns = [
    path("me", views.MeView.as_view(), name="me"),
    path("me/password", views.MyPasswordView.as_view(), name="my-password"),
    path("users", views.UsersView.as_view(), name="users"),
    path("users/<int:user_id>", views.UserView.as_view(), name="user"),
    path("users/<int:user_id>/password", views.UserPasswordView.as_view(), name="user-password"),
]
