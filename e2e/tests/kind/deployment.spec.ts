import { test, expect } from '@playwright/test';
import * as shell from 'shelljs';

test.describe('KIND Cluster Deployment', () => {
  let clusterName = 'l8physio-e2e';
  
  test.beforeAll(async () => {
    // Start KIND cluster
    const startResult = shell.exec(`kind create cluster --name ${clusterName}`);
    expect(startResult.code).toBe(0);
  });

  test.afterAll(async () => {
    // Stop and delete KIND cluster
    shell.exec(`kind delete cluster --name ${clusterName}`);
  });

  test('should deploy VNet service', async () => {
    // Deploy VNet
    const vnetResult = shell.exec(`kubectl apply -f go/k8s/physio-kind.yaml`);
    expect(vnetResult.code).toBe(0);
    
    // Wait for VNet to be ready
    const vnetReady = shell.exec(`kubectl wait --for=condition=Ready pod -l app=vnet --timeout=120s`);
    expect(vnetReady.code).toBe(0);
  });

  test('should deploy log-vnet service', async () => {
    const logVnetResult = shell.exec(`kubectl apply -f go/physio/log-vnet/`);
    expect(logVnetResult.code).toBe(0);
    
    const logVnetReady = shell.exec(`kubectl wait --for=condition=Ready pod -l app=physio-log-vnet --timeout=60s`);
    expect(logVnetReady.code).toBe(0);
  });

  test('should deploy log-agent service', async () => {
    const logAgentResult = shell.exec(`kubectl apply -f go/physio/log-agent/`);
    expect(logAgentResult.code).toBe(0);
    
    const logAgentReady = shell.exec(`kubectl wait --for=condition=Ready pod -l app=physio-log-agent --timeout=60s`);
    expect(logAgentReady.code).toBe(0);
  });

  test('should deploy boostapp services', async () => {
    const boostappResult = shell.exec(`kubectl apply -f go/physio/boostapp/main/`);
    expect(boostappResult.code).toBe(0);
    
    const boostappReady = shell.exec(`kubectl wait --for=condition=Ready pod -l app=physio-boostapp --timeout=60s`);
    expect(boostappReady.code).toBe(0);
  });

  test('should expose service via NodePort', async () => {
    const svcResult = shell.exec(`kubectl get service physio-ui -o jsonpath='{.spec.ports[0].nodePort}'`);
    expect(svcResult.code).toBe(0);
    expect(svcResult.stdout).not.toBe('');
  });

  test('should verify all pods are running', async () => {
    const podsResult = shell.exec(`kubectl get pods -o wide`);
    expect(podsResult.code).toBe(0);
    
    const lines = podsResult.stdout.split('\n');
    const runningPods = lines.filter(line => line.includes('Running')).length;
    expect(runningPods).toBeGreaterThan(3);
  });

  test('should test UI accessibility', async ({ request }) => {
    // Get NodePort
    const nodePortResult = shell.exec(`kubectl get service physio-ui -o jsonpath='{.spec.ports[0].nodePort}'`);
    expect(nodePortResult.code).toBe(0);
    const nodePort = nodePortResult.stdout.trim();
    
    // Test UI accessibility
    const localhost = 'localhost';
    const response = await request.get(`http://${localhost}:${nodePort}/l8ui/login/index.html`);
    expect(response.ok()).toBeTruthy();
  });
});
