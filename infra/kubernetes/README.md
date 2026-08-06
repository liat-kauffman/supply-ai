# Local Kubernetes

This directory contains a free local Kubernetes setup using `kind`. It runs
the backend worker locally inside Docker and does not create AWS resources.

The first example intentionally deploys only the backend worker. The production
frontend and RDS database remain on ECS and AWS.

## Prerequisites

Install Docker Desktop, then run:

```bash
brew install kind kubectl
```

## Create the cluster

```bash
kind create cluster --name supplai-local
```

## Build and load the image

```bash
docker build \
  --file backend/Dockerfile \
  --tag supplai-backend:local \
  .

kind load docker-image supplai-backend:local --name supplai-local
```

## Deploy the worker

```bash
kubectl apply -k infra/kubernetes/local
kubectl get pods --namespace supplai
kubectl get service --namespace supplai
```

The pod should become `Running` and `READY` should show `1/1`.

## Test the health endpoint

```bash
kubectl port-forward \
  --namespace supplai \
  service/supplai-backend 3001:3001
```

In another terminal:

```bash
curl http://127.0.0.1:3001/health/ready
```

## Inspect and clean up

```bash
kubectl logs \
  --namespace supplai \
  deployment/supplai-backend

kind delete cluster --name supplai-local
```
