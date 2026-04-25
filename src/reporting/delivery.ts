/**
 * Report delivery mechanisms
 */

import { writeFileSync } from 'fs';
import type { ValidationReport, ReportDeliveryResult } from './types.js';

export async function deliverToFile(report: ValidationReport, filepath: string): Promise<ReportDeliveryResult> {
  try {
    writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');
    return { success: true, destination: filepath };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, destination: filepath, error };
  }
}

export async function deliverToGitHubPR(
  report: ValidationReport,
  options: {
    owner: string;
    repo: string;
    prNumber: number;
    token: string;
    body: string;
  }
): Promise<ReportDeliveryResult> {
  try {
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: options.token });

    const { data: comments } = await octokit.issues.listComments({
      owner: options.owner,
      repo: options.repo,
      issue_number: options.prNumber,
    });

    const existingComment = comments.find(
      (c) => c.user?.login === 'github-actions[bot]' && c.body?.includes('## Covrr Validation')
    );

    if (existingComment) {
      await octokit.issues.updateComment({
        owner: options.owner,
        repo: options.repo,
        comment_id: existingComment.id,
        body: options.body,
      });
      return { success: true, destination: `pr:${options.prNumber}/comment:${existingComment.id}` };
    } else {
      const { data: newComment } = await octokit.issues.createComment({
        owner: options.owner,
        repo: options.repo,
        issue_number: options.prNumber,
        body: options.body,
      });
      return { success: true, destination: `pr:${options.prNumber}/comment:${newComment.id}` };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, destination: `pr:${options.prNumber}`, error };
  }
}

export async function deliverToWebhook(
  report: ValidationReport,
  options: {
    url: string;
    method?: 'POST' | 'PUT';
    headers?: Record<string, string>;
  }
): Promise<ReportDeliveryResult> {
  try {
    const method = options.method || 'POST';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(options.url, {
      method,
      headers,
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      return {
        success: false,
        destination: options.url,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return { success: true, destination: options.url };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, destination: options.url, error };
  }
}

export async function deliverReport(
  report: ValidationReport,
  outputs: Array<{
    type: 'file' | 'artifact' | 'github_pr_comment' | 'webhook';
    path?: string;
    name?: string;
    url?: string;
    method?: string;
    headers?: Record<string, string>;
  }>,
  githubContext?: { owner: string; repo: string; prNumber: number; token: string }
): Promise<ReportDeliveryResult[]> {
  const results: ReportDeliveryResult[] = [];

  for (const output of outputs) {
    switch (output.type) {
      case 'file':
        if (output.path) {
          results.push(await deliverToFile(report, output.path));
        }
        break;

      case 'github_pr_comment':
        if (githubContext) {
          const { formatMarkdown } = await import('./formatters.js');
          const body = formatMarkdown(report);
          results.push(
            await deliverToGitHubPR(report, { ...githubContext, body })
          );
        }
        break;

      case 'webhook':
        if (output.url) {
          results.push(
            await deliverToWebhook(report, {
              url: output.url,
              method: output.method as 'POST' | 'PUT' | undefined,
              headers: output.headers,
            })
          );
        }
        break;

      case 'artifact':
        results.push({ success: true, destination: `artifact:${output.name || 'covrr-report'}` });
        break;
    }
  }

  return results;
}