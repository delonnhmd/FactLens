import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { ClaimStatusBadge } from "@/components/claims/claim-status-badge";
import { SafeImage } from "@/components/ui/safe-image";
import type {
  PublicProfileEvidence,
  PublicProfilePost,
  PublicProfileReply,
} from "@/lib/types/profile-activity";
import { formatAbsoluteDate } from "@/lib/utils/dates";

const evidenceLabels = {
  SUPPORTS_TRUE: "Supports true",
  SUPPORTS_FAKE: "Supports fake",
  ADDS_CONTEXT: "Adds context",
  UNCLEAR: "Unclear",
} as const;

function finalVerdictLabel(value: PublicProfilePost["finalVerdict"]): string {
  if (value === "TRUE") return "Community says True";
  if (value === "FAKE") return "Community says Fake";
  if (value === "NEEDS_MORE_EVIDENCE") return "Needs more evidence";
  return "Verdict pending";
}

export function PublicProfilePosts({ posts }: { readonly posts: readonly PublicProfilePost[] }) {
  return (
    <ol className="space-y-4">
      {posts.map((post) => {
        const imageUrl = post.thumbnailUrl ?? post.imageUrl;
        return (
          <li key={post.id}>
            <article className="overflow-hidden rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white">
              {imageUrl ? (
                <div className="relative aspect-video bg-[var(--ff-surface)]">
                  <SafeImage alt="" className="object-cover" fill sizes="(max-width: 768px) 100vw, 720px" src={imageUrl} />
                </div>
              ) : null}
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  {post.category ? <span className="rounded-full border border-[var(--ff-border)] px-2.5 py-1 text-xs text-[var(--ff-text-secondary)]">{post.category}</span> : null}
                  <ClaimStatusBadge status={post.status} />
                </div>
                <h2 className="mt-4 text-xl leading-7 font-medium text-[var(--ff-navy)]">
                  <Link className="rounded-sm hover:underline" href={`/claim/${post.id}`}>{post.title}</Link>
                </h2>
                {post.descriptionPreview ? <p className="mt-2 text-sm leading-6 text-[var(--ff-text-secondary)]">{post.descriptionPreview}</p> : null}
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-[var(--ff-text-muted)]">Final verdict</dt><dd className="mt-1 font-medium">{finalVerdictLabel(post.finalVerdict)}</dd></div>
                  <div><dt className="text-xs text-[var(--ff-text-muted)]">Total votes</dt><dd className="mt-1 font-medium">{post.votes.total.toLocaleString()}</dd></div>
                  <div><dt className="text-xs text-[var(--ff-text-muted)]">True / Fake</dt><dd className="mt-1 font-medium">{post.votes.true.toLocaleString()} / {post.votes.fake.toLocaleString()}</dd></div>
                  <div><dt className="text-xs text-[var(--ff-text-muted)]">Created</dt><dd className="mt-1 font-medium">{formatAbsoluteDate(post.createdAt)}</dd></div>
                </dl>
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

export function PublicProfileReplies({ replies }: { readonly replies: readonly PublicProfileReply[] }) {
  return (
    <ol className="space-y-4">
      {replies.map((reply) => (
        <li key={reply.id}>
          <article className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5 sm:p-6">
            <p className="whitespace-pre-line leading-7 text-[var(--ff-text)]">{reply.text}</p>
            <Link className="mt-4 block rounded-sm text-sm font-medium text-[var(--ff-navy)] hover:underline" href={`/claim/${reply.claimId}#${reply.anchor}`}>
              On: {reply.claimTitle}
            </Link>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--ff-text-muted)]">
              <span>{formatAbsoluteDate(reply.createdAt)}</span>
              {reply.replyCount > 0 ? <span>{reply.replyCount} {reply.replyCount === 1 ? "reply" : "replies"}</span> : null}
              {reply.helpfulCount > 0 ? <span>{reply.helpfulCount} helpful</span> : null}
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}

export function PublicProfileEvidenceList({ evidence }: { readonly evidence: readonly PublicProfileEvidence[] }) {
  return (
    <ol className="space-y-4">
      {evidence.map((item) => {
        const imageUrl = item.thumbnailUrl ?? item.imageUrl;
        return (
          <li key={item.id}>
            <article className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white p-5 sm:p-6">
              <span className="rounded-full bg-[var(--ff-navy)] px-2.5 py-1 text-xs font-medium text-white">{evidenceLabels[item.type]}</span>
              {item.note ? <p className="mt-4 whitespace-pre-line text-sm leading-6 text-[var(--ff-text-secondary)]">{item.note}</p> : null}
              {imageUrl ? <div className="relative mt-4 aspect-video overflow-hidden rounded-[var(--ff-radius-card)] bg-[var(--ff-surface)]"><SafeImage alt="Evidence attachment" className="object-cover" fill sizes="(max-width: 768px) 100vw, 720px" src={imageUrl} /></div> : null}
              <Link className="mt-4 block rounded-sm text-sm font-medium text-[var(--ff-navy)] hover:underline" href={`/claim/${item.claimId}`}>For: {item.claimTitle}</Link>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--ff-text-muted)]">
                <span>{formatAbsoluteDate(item.createdAt)}</span>
                {item.helpfulCount > 0 ? <span>{item.helpfulCount} helpful</span> : null}
                {item.sourceUrl ? <a className="inline-flex items-center gap-1 rounded-sm font-medium text-[var(--ff-navy)] hover:underline" href={item.sourceUrl} rel="noopener noreferrer" target="_blank"><ExternalLink aria-hidden="true" size={13} />{item.sourceDomain ?? "Open source"}</a> : null}
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
