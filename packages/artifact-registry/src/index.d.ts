/**
 * artifact-registry — 本地 Artifact 读取与保存
 *
 * 从 artifacts/<user>/ 目录扫描 .md 文件，
 * 解析 YAML frontmatter + Markdown body，映射为 Artifact 类型。
 *
 * MVP 支持三层操作：
 * 1. listHeaders — 加载所有 Artifact Header（供 L0 快速判断）
 * 2. load — 加载完整 Artifact（Header + Body）
 * 3. save — 写入新 Artifact
 */
import type { Artifact, ArtifactHeader } from "@ethan-computer/protocol-types";
export interface ArtifactSummary {
    artifact_id: string;
    header: ArtifactHeader;
}
export interface ArtifactRegistry {
    /** 列出所有 Artifact 的 Header 摘要 */
    listHeaders(user: string): Promise<ArtifactSummary[]>;
    /** 加载完整 Artifact */
    load(user: string, artifactId: string): Promise<Artifact>;
    /** 保存 Artifact */
    save(user: string, artifact: Artifact): Promise<void>;
}
export declare function createArtifactRegistry(artifactsDir: string): ArtifactRegistry;
//# sourceMappingURL=index.d.ts.map