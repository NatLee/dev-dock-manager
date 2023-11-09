# Development Container Manager

This is a Docker container manager developed using Django, providing isolated development environments with a suite of base functions and packages for each user on the same machine.

This project combines the following repositories:
- [GUI-container-using-xfce-with-vnc](https://github.com/NatLee/GUI-container-using-xfce-with-vnc)
- [django-docker-gui](https://github.com/NatLee/django-docker-gui)

## Nvidia Docker Support

Nvidia Docker support is available under certain conditions.

Ensure your system has Nvidia drivers installed and the Nvidia Docker runtime is set up correctly.

This feature is optional and can be enabled during container creation if your system meets the requirements.

# Usage

> Only support x86/64 machine.

Notice that you need to clone the submodule at the first.

```
git submodule update --init --recursive
```

## Quick start

> Docker daemon must be running.

1. Build GUI container.

```
cd gui && docker-compose build
```

2. Back to the root of this repo and use command to start the web service.

```
docker-compose build && docker-compose up -d
```

3. Create a superuser for Django admin.

> Check the script `./dev-create-superuser.sh` and change the username and password if you want.

```
bash dev-create-superuser.sh
```

4. Go to http://localhost:8000, it will show the login page.

## Interface

- Container list

    ![container-list](./doc/container-list.png)

- Container creation form

    ![container-creation-form](./doc/container-creation-form.png)

- Container with NoVNC

    ![novnc-demo](./doc/novnc-demo.png)

- Web terminal

    ![web-terminal](./doc/web-terminal.png)

# License

[MIT](./LICENSE)

