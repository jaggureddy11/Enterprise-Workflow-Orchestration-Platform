import { test, expect } from '@playwright/test';

test.describe('EWAP Critical Path', () => {
  // Use a unique tenant and user per run for isolation
  const tenantName = `tenant-${Date.now()}`;
  const userEmail = `admin@${tenantName}.com`;
  const password = 'Password123!';

  test('should complete the critical path workflow', async ({ page, request }) => {
    // Note: This test assumes the API gateway is running on localhost:4000
    // and the frontend is on localhost:3010
    const apiBaseUrl = 'http://localhost:4000';

    // 1. Register Tenant (via API for speed)
    const registerResponse = await request.post(`${apiBaseUrl}/api/auth/register-tenant`, {
      data: {
        tenantName: tenantName,
        tenantSlug: tenantName,
        ownerEmail: userEmail,
        ownerPassword: password,
        ownerFirstName: 'Admin',
        ownerLastName: 'User'
      },
    });
    
    // Expecting 201 Created
    expect(registerResponse.status()).toBe(201);
    
    const resBody = await registerResponse.json();
    const token = resBody.data.accessToken;
    expect(token).toBeTruthy();

    // 2. We can either do UI tests or API tests.
    // Given the frontend might not be fully built/mocked, we'll test API flow first,
    // then can add UI steps if needed.
    
    // Example: Create a Workflow Definition
    const workflowResponse = await request.post(`${apiBaseUrl}/api/workflows`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      data: {
        name: 'Employee Onboarding',
        description: 'Standard onboarding process',
        triggerType: 'MANUAL',
        triggerConfig: {},
        definition: {
          steps: [
            {
              name: 'IT Setup',
              type: 'TASK',
              order: 1,
              config: {
                assigneeType: 'ROLE',
                assigneeValue: 'IT_ADMIN',
                formSchema: {},
                slaHours: 24
              },
              isTerminal: true
            }
          ]
        }
      }
    });

    expect(workflowResponse.status()).toBe(201);
    const workflowResBody = await workflowResponse.json();
    const workflowId = workflowResBody.data.id;

    // Publish the workflow so it is ACTIVE
    const publishResponse = await request.post(`${apiBaseUrl}/api/workflows/${workflowId}/publish`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    expect(publishResponse.status()).toBe(200);

    // Example: Start a Workflow Instance
    const instanceResponse = await request.post(`${apiBaseUrl}/api/workflows/${workflowId}/trigger`, {
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
    const instanceResBody = await instanceResponse.json();
    const instanceId = instanceResBody.data?.instanceId;
    expect(instanceId).toBeTruthy();

    // In a real E2E test, we would then query the task service for tasks 
    // assigned and mark them as complete, then check the workflow instance status.
  });
});
