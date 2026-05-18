#!/bin/bash

# It is recommended to unlock the ssh key before, for instance :
# eval `ssh-agent`
# ssh-add ~/.ssh/id_rsa

set -e

source publish.env.sh

echo "==== COPY SERVER ===="
pushd src
scp couchdb/docker-compose.yml $SSH_USER_AND_HOST:$SSH_REMOTE_PATH/couchdb/
scp couchdb/local.ini.example $SSH_USER_AND_HOST:$SSH_REMOTE_PATH/couchdb/

scp push-server/*.json $SSH_USER_AND_HOST:$SSH_REMOTE_PATH/push-server/
scp push-server/Dockerfile $SSH_USER_AND_HOST:$SSH_REMOTE_PATH/push-server/
scp -r push-server/src/* $SSH_USER_AND_HOST:$SSH_REMOTE_PATH/push-server/src/

ssh $SSH_USER_AND_HOST "sudo ./start.sh"
popd