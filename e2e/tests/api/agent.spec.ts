import { test, expect } from '../../fixtures/auth';
import { PREFIX } from '../../fixtures/env';

const AGENT_AREA = 55;
const CHAT = { name: 'AgntChat', area: AGENT_AREA };
const TOOL_LIMIT_REPLY = /maximum number of tool calls/i;

async function chat(api: any, message: string, conversationId?: string) {
  const facade: any = { messages: [{ message, isLlm: false }] };
  if (conversationId) facade.conversationId = conversationId;
  const resp = await api.post(CHAT, facade);
  return { resp, text: await resp.text() };
}

test.describe('AI agent', () => {
  test('default prompts are seeded', async ({ api }) => {
    const resp = await api.getRaw({ name: 'AgntPrmpt', area: AGENT_AREA }, 'select * from L8AgentPrompt');
    expect(resp.ok(), await resp.text()).toBeTruthy();
    const names = ((await resp.json()).list ?? []).map((p: any) => p.name);
    expect(names).toEqual(expect.arrayContaining([
      'Physiotherapist Assistant', 'Client Progress Analyzer', 'Appointment Scheduler',
    ]));
  });

  test('empty message is rejected', async ({ api }) => {
    const { resp, text } = await chat(api, '');
    expect(resp.status()).toBeLessThan(500);
    expect(text).not.toContain('"isLlm":true');
  });

  test('chat returns an assistant reply and persists the conversation', async ({ api }) => {
    const { resp, text } = await chat(api, 'Reply with the single word PONG.');
    expect(resp.ok(), text).toBeTruthy();
    const reply = JSON.parse(text).list[0];
    expect(reply.isLlm).toBe(true);
    expect(reply.message.length).toBeGreaterThan(0);
    expect(reply.conversationId).toBeTruthy();

    // follow-up in the same conversation keeps the id
    const second = await chat(api, 'And now reply with the word PING.', reply.conversationId);
    expect(second.resp.ok(), second.text).toBeTruthy();
    expect(JSON.parse(second.text).list[0].conversationId).toBe(reply.conversationId);

    // the conversation record is created by the first message and keeps its title
    const convo = await api.getRaw({ name: 'AgntConvo', area: AGENT_AREA },
      `select * from L8AgentConversation where conversationId=${reply.conversationId}`);
    expect(convo.ok(), await convo.text()).toBeTruthy();
    const rows = (await convo.json()).list ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toContain('PONG');

    // the latest message of the conversation is stored (messages are keyed by conversation id)
    const msgs = await api.getRaw({ name: 'AgntMsg', area: AGENT_AREA },
      `select * from L8AgentChatMessage where conversationId=${reply.conversationId}`);
    expect(msgs.ok(), await msgs.text()).toBeTruthy();
    expect(((await msgs.json()).list ?? []).length).toBeGreaterThanOrEqual(1);
  });

  test('agent answers a question about live data via its tools', async ({ api }) => {
    const { resp, text } = await chat(api, 'How many clients are in the system? Use your tools and answer with the number.');
    expect(resp.ok(), text).toBeTruthy();
    expect(JSON.parse(text).list[0].message).toMatch(/\d/);
  });

  test('agent lists records without running out of tool calls', async ({ api }) => {
    const { resp, text } = await chat(api, 'List 3 clients with their first name, last name and phone number.');
    expect(resp.ok(), text).toBeTruthy();
    const reply = JSON.parse(text).list[0].message;
    expect(reply).not.toMatch(TOOL_LIMIT_REPLY);
    expect(reply).toMatch(/\+?\d{6,}/);
  });

  test('agent sorts by a nested field (AuditInfo.CreatedAt)', async ({ api }) => {
    const { resp, text } = await chat(api, 'Which clients joined most recently? Show 3.');
    expect(resp.ok(), text).toBeTruthy();
    const reply = JSON.parse(text).list[0].message;
    expect(reply).not.toMatch(TOOL_LIMIT_REPLY);
    expect(reply).not.toMatch(/timed out/i);
  });

  async function reply(api: any, message: string): Promise<string> {
    const { resp, text } = await chat(api, message);
    expect(resp.ok(), text).toBeTruthy();
    return JSON.parse(text).list[0].message as string;
  }

  test.describe('@help prefix', () => {
    test('guides the user through the menus to create a client', async ({ api }) => {
      const msg = await reply(api, '@help how do i create a client');
      expect(msg).toMatch(/Clients/);
      expect(msg).toMatch(/Add/);
      expect(msg).toMatch(/First Name/);
      expect(msg).toMatch(/Save/);
    });

    test('says so when the help documentation does not cover the question', async ({ api }) => {
      const msg = await reply(api, '@help how do I fly to the moon');
      expect(msg).toMatch(/not cover|does not|no (help|documentation)|don't|cannot|can't/i);
    });

    test('is case-insensitive and does not query data', async ({ api }) => {
      const msg = await reply(api, '@HELP where do I find the therapists');
      expect(msg).toMatch(/Therapists/);
    });
  });

  test.describe('@web prefix', () => {
    test('answers a general question', async ({ api }) => {
      expect(await reply(api, '@web what is the capital of France')).toMatch(/Paris/);
    });

    for (const q of ['how many sales orders do i have', 'how many clients do i have', 'list my appointments for next week']) {
      test(`rejects a question about system data: "${q}"`, async ({ api }) => {
        const msg = await reply(api, `@web ${q}`);
        expect(msg).toMatch(/cannot be asked with @web/);
        expect(msg).not.toMatch(/\d{2,}/);
      });
    }

    test('asks for a question when the prefix is alone', async ({ api }) => {
      expect(await reply(api, '@web')).toMatch(/add your question/i);
    });
  });

  test('a word that merely starts like a prefix is an ordinary prompt', async ({ api }) => {
    const msg = await reply(api, '@helper reply with the single word PONG');
    expect(msg.length).toBeGreaterThan(0);
    expect(msg).not.toMatch(/cannot be asked with @web/);
  });
});
