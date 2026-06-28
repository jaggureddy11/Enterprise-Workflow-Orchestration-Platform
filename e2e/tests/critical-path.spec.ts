import { test, expect } from '@playwright/test';

test.describe('EWAP Critical Path', () => {
  // Use a unique tenant and user per run for isolation
  const tenantName = `tenant-${Date.now()}`;
  const userEmail = `admin@${tenantName}.com`;
  const password = 'Password123!';

  test('should complete the critical path workflow', async ({ page, request }) => {
    // Note: This test assumes the API gateway is running on localhost:3000
    // and the frontend is on localhost:3001
    const apiBaseUrl = 'http://localhost:3000';

    // 1. Register Tenant (via API for speed)
    const registerResponse = await request.post(`${apiBaseUrl}/auth/register-tenant`, {
      data: {
        name: tenantName,
        slug: tenantName,
        adminEmail: userEmail,
        adminPassword: password,
      },
    });
    
    // Expecting 201 Created
    expect(registerResponse.status()).toBe(201);
    
    const { token } = await registerResponse.json();
    expect(token).toBeTruthy();

    // 2. We can either do UI tests or API tests.
    // Given the frontend might not be fully built/mocked, we'll test API flow first,
    // then can add UI steps if needed.
    
    // Example: Create a Workflow Definition
    const workflowResponse = await request.post(`${apiBaseUrl}/workflows`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      data: {
        name: 'Employee Onboarding',
        description: 'Standard onboarding process',
        version: 1,
        steps: [
          {
            stepId: 'step-1',
            type: 'TASK',
            name: 'IT Setup',
            config: {
              assigneeType: 'ROLE',
              assigneeValue: 'IT_ADMIN',
              formSchema: {},
              slaHours: 24
            }
          }
        ]
      }
    });

    expect(workflowResponse.status()).toBe(201);
    const { id: workflowId } = await workflowResponse.json();

    // Example: Start a Workflow Instance
    const instanceResponse = await request.post(`${apiBaseUrl}/workflows/${workflowId}/trigger`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      data: {
        triggerData: {
          employeeName: 'John Doe',
          department: 'Engineering'
        }
      }
    });

    expect(instanceResponse.status()).toBe(201);
    const { instanceId } = await instanceResponse.json();
    expect(instanceId).toBeTruthy();

    // In a real E2E test, we would then query the task service for tasks 
    // assigned and mark them as complete, then check the workflow instance status.
  });
});
