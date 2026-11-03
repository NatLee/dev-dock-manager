FROM python:3.11.9-slim-bullseye

ENV PYTHONUNBUFFERED=1

WORKDIR /src

RUN apt-get update

# Install dependencies
COPY requirements.txt /src
RUN python -m pip install --upgrade pip
# drf-yasg 1.21.4 imports pkg_resources, which newer setuptools no longer ships
RUN pip install --upgrade "setuptools<81"
RUN pip install -r requirements.txt

# Copy source code
COPY ./src /src

EXPOSE 80

