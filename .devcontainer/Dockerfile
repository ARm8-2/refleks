FROM debian:bookworm-slim

# 1. Install system dependencies and configure locale
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl git zip ca-certificates build-essential pkg-config \
    libgtk-3-dev libwebkit2gtk-4.0-dev sudo \
    bash-completion locales nsis \
    && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen \
    && locale-gen \
    && rm -rf /var/lib/apt/lists/*

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

# 2. Install Node.js 22 (LTS) from Nodesource
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# 3. Setup 'vscode' user
ARG USERNAME=vscode
RUN groupadd --gid 1000 $USERNAME \
    && useradd --uid 1000 --gid 1000 -m -s /bin/bash $USERNAME \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && cp /etc/skel/.bashrc /home/$USERNAME/.bashrc \
    && chown $USERNAME:$USERNAME /home/$USERNAME/.bashrc

# 4. Install Go 1.24
ENV GO_VERSION=1.24.0
RUN curl -L https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz | tar -C /usr/local -xzf -
ENV PATH=$PATH:/usr/local/go/bin

USER $USERNAME
ENV HOME=/home/$USERNAME
ENV PATH=$PATH:$HOME/go/bin

# 5. Install Wails
RUN go install github.com/wailsapp/wails/v2/cmd/wails@v2.10.2

WORKDIR /workspaces/refleks