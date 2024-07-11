FROM python:3.11.9-slim-bullseye

ENV PYTHONUNBUFFERED=1

WORKDIR /src

RUN apt-get update

# Install dependencies
COPY requirements.txt /src
RUN python -m pip install --upgrade pip
RUN pip install --upgrade setuptools
RUN pip install -r requirements.txt

# Copy source code
COPY ./src /src

EXPOSE 80

