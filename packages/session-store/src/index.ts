/**
 * session-store — 最小会话记录层
 *
 * 参考 CraftAgent 的 JSONL 模式：
 * - Line 1: SessionHeader（元数据，原子更新）
 * - Lines 2+: SessionMessage（每行一条，即时 append）
 *
 * 设计原则：
 * - 每轮对话即时 append，不是事后拼凑
 * - 原子写入防崩溃（write-to-temp → rename）
 * - 容错读取（跳过损坏行，不丢全部消息）
 * - 恢复时从 JSONL 重建完整历史
 */

import { existsSync } from "node:fs";
import {
  readFile,
  writeFile,
  appendFile,
  rename,
  unlink,
  mkdir,
} from "node:fs/promises";
import { dirname, join } from "node:path";

// ── 类型定义 ────────────────────────────────────────────

export interface SessionHeader {
  /** 会话 ID */
  id: string;
  /** 创建时间 (ms) */
  createdAt: number;
  /** 最后更新时间 (ms) */
  updatedAt: number;
  /** 消息数量 */
  messageCount: number;
  /** 运行时来源（如 "l0-runtime"） */
  source?: string;
  /** 附加元数据 */
  metadata?: Record<string, unknown>;
}

export interface SessionMessage {
  role: "user" | "assistant";
  content: string;
  /** 消息时间戳 (ms) */
  timestamp: number;
  /** 附加元数据（如 layer, action 等） */
  metadata?: Record<string, unknown>;
}

// ── JSONL 读写 ─────────────────────────────────────────

/**
 * 从 JSONL 文件读取完整会话。
 * 容错：损坏行跳过而非整体失败。
 */
function readJsonl(filePath: string): {
  header: SessionHeader;
  messages: SessionMessage[];
} | null {
  try {
    if (!existsSync(filePath)) return null;
    const content = require("fs").readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    if (lines.length === 0) return null;

    // Line 1: header
    let header: SessionHeader;
    try {
      header = JSON.parse(lines[0]) as SessionHeader;
    } catch {
      return null; // header 损坏 = 整个文件不可用
    }

    // Lines 2+: messages（容错解析）
    const messages: SessionMessage[] = [];
    for (let i = 1; i < lines.length; i++) {
      try {
        messages.push(JSON.parse(lines[i]) as SessionMessage);
      } catch {
        // 跳过损坏行（崩溃中断写入等）
      }
    }

    return { header, messages };
  } catch {
    return null;
  }
}

/**
 * 原子写入 header（write-to-temp → rename）。
 * 不影响后续消息行。
 */
async function writeHeaderAtomic(filePath: string, header: SessionHeader): Promise<void> {
  // 确保目录存在
  await mkdir(dirname(filePath), { recursive: true });
  // 读取现有消息行（保留）
  let messageLines = "";
  if (existsSync(filePath)) {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");
    // 保留 Line 2+ 的消息行
    if (lines.length > 1) {
      messageLines = "\n" + lines.slice(1).join("\n");
    }
  }

  const tmpPath = filePath + ".tmp";
  const data = JSON.stringify(header) + messageLines + "\n";
  await writeFile(tmpPath, data, "utf-8");
  try { await unlink(filePath); } catch { /* 不存在则忽略 */ }
  await rename(tmpPath, filePath);
}

/**
 * Append 一条消息到 JSONL 文件。
 * 只在文件末尾追加，不影响已有内容。
 */
async function appendMessage(filePath: string, message: SessionMessage): Promise<void> {
  const line = JSON.stringify(message) + "\n";
  await appendFile(filePath, line, "utf-8");
}

// ── SessionRecorder ─────────────────────────────────────

export interface SessionRecorder {
  /** 追加一条消息（即时写入磁盘） */
  append(message: SessionMessage): Promise<void>;
  /** 获取所有已记录的消息 */
  getMessages(): SessionMessage[];
  /** 获取会话 header */
  getHeader(): SessionHeader;
  /** 更新 header 元数据（原子写入） */
  updateHeader(metadata: Record<string, unknown>): Promise<void>;
  /** 获取完整会话（header + messages） */
  toJSONL(): string;
}

export interface CreateSessionRecorderOptions {
  /** 会话存储目录 */
  sessionsDir: string;
  /** 会话 ID */
  sessionId: string;
  /** 来源标记 */
  source?: string;
  /** 初始元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 创建一个新的 SessionRecorder。
 *
 * 如果文件已存在，加载历史记录（恢复场景）。
 * 如果不存在，创建新文件。
 */
export async function createSessionRecorder(
  options: CreateSessionRecorderOptions,
): Promise<SessionRecorder> {
  const { sessionsDir, sessionId, source, metadata } = options;
  await mkdir(sessionsDir, { recursive: true });

  const filePath = join(sessionsDir, `${sessionId}.jsonl`);
  let header: SessionHeader;
  let messages: SessionMessage[];

  // 尝试加载已有会话
  const existing = readJsonl(filePath);
  if (existing) {
    header = existing.header;
    messages = existing.messages;
  } else {
    // 新建会话
    header = {
      id: sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      source,
      metadata,
    };
    messages = [];
    await writeHeaderAtomic(filePath, header);
  }

  return {
    async append(message: SessionMessage) {
      messages.push(message);
      header.messageCount = messages.length;
      header.updatedAt = Date.now();
      await appendMessage(filePath, message);
      // 异步更新 header 的 messageCount 和 updatedAt
      // 注意：这里是 append 后更新 header，崩溃时可能 header 的 count 略少于实际行数
      // 容错方案：加载时以实际行数为准
      writeHeaderAtomic(filePath, header).catch(() => {
        // header 更新失败不影响消息已写入
      });
    },

    getMessages() {
      return [...messages];
    },

    getHeader() {
      return { ...header };
    },

    async updateHeader(newMetadata: Record<string, unknown>) {
      header.metadata = { ...header.metadata, ...newMetadata };
      header.updatedAt = Date.now();
      await writeHeaderAtomic(filePath, header);
    },

    toJSONL() {
      const lines = [
        JSON.stringify(header),
        ...messages.map((m) => JSON.stringify(m)),
      ];
      return lines.join("\n") + "\n";
    },
  };
}

/**
 * 列出指定目录下的所有会话 ID。
 */
export async function listSessions(sessionsDir: string): Promise<string[]> {
  if (!existsSync(sessionsDir)) return [];
  const entries = await import("node:fs/promises").then((m) =>
    m.readdir(sessionsDir),
  );
  return entries
    .filter((e) => e.endsWith(".jsonl"))
    .map((e) => e.replace(/\.jsonl$/, ""));
}

/**
 * 加载指定会话的 header（不读消息，用于快速列表）。
 */
export function loadSessionHeader(
  sessionsDir: string,
  sessionId: string,
): SessionHeader | null {
  const filePath = join(sessionsDir, `${sessionId}.jsonl`);
  const result = readJsonl(filePath);
  return result?.header ?? null;
}
