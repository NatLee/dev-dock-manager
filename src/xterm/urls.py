from django.urls import path
import logging

from xterm import views

logger = logging.getLogger(__name__)

urlpatterns = [
    path('api/images', views.ImagesListView.as_view(), name='images-api'),
    path('api/containers', views.ContainersListView.as_view(), name='containers-api'),
    path('api/container/new', views.RunContainerView.as_view(), name='run-new-container'),
    path('api/containers/control', views.ContainersControl.as_view(), name='containers-control'),
    path('api/console/<str:action>/<str:id>', views.ConsoleView.as_view(), name='console'),
    path('api/ports', views.FreePortsAPIView.as_view(), name='free-ports'),
    path('api/ports/check', views.PortCheckAPIView.as_view(), name='check-port'),
    path('api/nvdocker/check', views.NvidiaDockerCheckAPIView.as_view(), name='check-nvdocker'),
    path('api/linux/check', views.LinuxCheckAPIView.as_view(), name='check-linux'),
]