import { test, expect } from '@playwright/test';

test.describe('REST API', () => {
  test('GET /0/Health should return 200', async ({ request }) => {
    const response = await request.get('/0/Health');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
  });

  test('GET /0/Registry should return 200', async ({ request }) => {
    const response = await request.get('/0/Registry');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('types');
  });

  test('POST /0/PhyClient should create client', async ({ request }) => {
    const response = await request.post('/0/PhyClient', {
      data: {
        firstName: 'Test',
        lastName: 'Client',
        email: `test.${Date.now()}@example.com`,
        therapistId: 'therapist-1',
        status: 1,
      },
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('id');
  });

  test('GET /0/PhyClient/{id} should return client', async ({ request }) => {
    const clientResponse = await request.post('/0/PhyClient', {
      data: {
        firstName: 'Get',
        lastName: 'Test',
        email: `get.${Date.now()}@example.com`,
        therapistId: 'therapist-1',
        status: 1,
      },
    });
    const clientData = await clientResponse.json();
    
    const getResponse = await request.get(`/0/PhyClient/${clientData.id}`);
    expect(getResponse.ok()).toBeTruthy();
    const data = await getResponse.json();
    expect(data.firstName).toBe('Get');
  });

  test('PUT /0/PhyClient/{id} should update client', async ({ request }) => {
    const clientResponse = await request.post('/0/PhyClient', {
      data: {
        firstName: 'Put',
        lastName: 'Test',
        email: `put.${Date.now()}@example.com`,
        therapistId: 'therapist-1',
        status: 1,
      },
    });
    const clientData = await clientResponse.json();
    
    const updateResponse = await request.put(`/0/PhyClient/${clientData.id}`, {
      data: {
        firstName: 'Put',
        lastName: 'Updated',
        email: `put.${Date.now()}@example.com`,
        therapistId: 'therapist-1',
        status: 1,
      },
    });
    expect(updateResponse.ok()).toBeTruthy();
    
    const getResponse = await request.get(`/0/PhyClient/${clientData.id}`);
    const data = await getResponse.json();
    expect(data.lastName).toBe('Updated');
  });

  test('DELETE /0/PhyClient/{id} should soft delete client', async ({ request }) => {
    const clientResponse = await request.post('/0/PhyClient', {
      data: {
        firstName: 'Delete',
        lastName: 'Test',
        email: `delete.${Date.now()}@example.com`,
        therapistId: 'therapist-1',
        status: 1,
      },
    });
    const clientData = await clientResponse.json();
    
    const deleteResponse = await request.delete(`/0/PhyClient/${clientData.id}`);
    expect(deleteResponse.ok()).toBeTruthy();
    
    const getResponse = await request.get(`/0/PhyClient/${clientData.id}`);
    const data = await getResponse.json();
    expect(data.isActive).toBe(false);
  });
});
