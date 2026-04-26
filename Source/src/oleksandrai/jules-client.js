/**
 * JulesClient - API Client for OleksandrAi 3.0 Agent (Jules)
 */
class JulesClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://jules.googleapis.com/v1alpha';
        this.currentSessionId = null;
    }

    async listSources() {
        try {
            const response = await fetch(`${this.baseUrl}/sources`, {
                headers: { 'X-Goog-Api-Key': this.apiKey }
            });
            return await response.json();
        } catch (error) {
            console.error('Error listing sources:', error);
            throw error;
        }
    }

    async createSession(prompt, sourceContext) {
        const url = `${this.baseUrl}/sessions`;

        // Use provided source context or default if available
        // If sourceContext is not provided, we might omit it, but for standard usage it's often required.
        // Documentation suggests sourceContext is needed for modifying a repo.
        // We will default to a placeholder if none provided, or rely on the caller.

        const body = {
            prompt: prompt,
            automationMode: "AUTO_CREATE_PR",
            title: prompt.substring(0, 50)
        };

        if (sourceContext) {
            body.sourceContext = sourceContext;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey
                },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error.message);
            }
            if (data.name) {
                this.currentSessionId = data.name; // "sessions/..."
            }
            return data;
        } catch (error) {
            console.error('Error creating session:', error);
            throw error;
        }
    }

    async sendMessage(prompt, sessionId = this.currentSessionId) {
        if (!sessionId) throw new Error("No active session");

        // The endpoint is actually simpler based on typical patterns:
        // POST /v1alpha/{session_id}:sendMessage
        // But let's follow the pattern we saw in curl:
        // curl 'https://jules.googleapis.com/v1alpha/sessions/SESSION_ID:sendMessage'

        const url = `${this.baseUrl}/${sessionId}:sendMessage`;
        const body = { prompt };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey
                },
                body: JSON.stringify(body)
            });
            return await response.json();
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    async approvePlan(sessionId = this.currentSessionId) {
        if (!sessionId) throw new Error("No active session");

        const url = `${this.baseUrl}/${sessionId}:approvePlan`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey
                },
                body: JSON.stringify({}) // Empty body usually required
            });
            return await response.json();
        } catch (error) {
            console.error('Error approving plan:', error);
            throw error;
        }
    }

    async getSession(sessionId = this.currentSessionId) {
        if (!sessionId) return null;

        const url = `${this.baseUrl}/${sessionId}`;
        try {
            const response = await fetch(url, {
                headers: { 'X-Goog-Api-Key': this.apiKey }
            });
            return await response.json();
        } catch (error) {
            console.error('Error getting session:', error);
            throw error;
        }
    }

    _safeString(value) {
        if (typeof value === 'string') return value.trim();
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        return '';
    }

    _isPatchText(text) {
        return /diff --git|^@@|^\+\+\+ |^--- /m.test(text || '');
    }

    _extractMarkdownCodeBlocks(text) {
        if (!text || typeof text !== 'string') return [];

        const blocks = [];
        const fencePattern = /```(?:[\w.+-]+)?\s*\n([\s\S]*?)```/g;
        let match;
        while ((match = fencePattern.exec(text)) !== null) {
            const block = this._safeString(match[1]);
            if (block && block.length >= 10) {
                blocks.push(block);
            }
        }

        return blocks;
    }

    _looksStructuredCode(text) {
        if (!text || text.length < 20) return false;
        if (this._isPatchText(text)) return false;

        const lines = text
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);
        if (lines.length < 3) return false;

        let signal = 0;
        if (/[{}()[\];]/.test(text)) signal++;
        if (/<!doctype html|<html[\s>]|<\/[a-z][^>]*>/i.test(text)) signal++;
        if (/^\s*(const|let|var|function|class|import|export|def|public|private|select|insert|update|create|from)\b/im.test(text)) signal++;

        return signal >= 2;
    }

    _formatPlan(planValue) {
        if (!planValue) return '';

        if (typeof planValue === 'string') {
            return planValue.trim();
        }

        if (Array.isArray(planValue)) {
            const lines = planValue
                .map((step, idx) => {
                    const text = this._safeString(step) || this._safeString(step?.title) || this._safeString(step?.description);
                    return text ? `${idx + 1}. ${text}` : '';
                })
                .filter(Boolean);
            return lines.join('\n').trim();
        }

        if (typeof planValue === 'object') {
            if (Array.isArray(planValue.steps)) {
                const stepLines = planValue.steps
                    .map((step, idx) => {
                        const title = this._safeString(step?.title);
                        const description = this._safeString(step?.description);
                        const text = title || description || this._safeString(step);
                        return text ? `${idx + 1}. ${text}` : '';
                    })
                    .filter(Boolean);
                if (stepLines.length) return stepLines.join('\n');
            }

            const summary = this._safeString(planValue.summary) || this._safeString(planValue.description) || this._safeString(planValue.title);
            if (summary) return summary;

            try {
                return JSON.stringify(planValue, null, 2);
            } catch (_) {
                return '';
            }
        }

        return this._safeString(planValue);
    }

    _extractPlanFromActivities(activities) {
        if (!Array.isArray(activities) || activities.length === 0) return '';
        let latestPlan = '';

        for (const activity of activities) {
            if (!activity || !activity.planGenerated) continue;
            const rawPlan =
                activity.planGenerated.plan ||
                activity.planGenerated.steps ||
                activity.planGenerated;
            const formatted = this._formatPlan(rawPlan);
            if (formatted) latestPlan = formatted;
        }

        return latestPlan;
    }

    _parseToolCallArgs(toolCall) {
        if (!toolCall) return null;
        const args = toolCall.arguments;
        if (!args) return null;

        if (typeof args === 'string') {
            try {
                return JSON.parse(args);
            } catch (_) {
                return { raw: args };
            }
        }

        if (typeof args === 'object') return args;
        return null;
    }

    _isLikelyCode(text) {
        if (!text || text.length < 20) return false;
        if (this._isPatchText(text)) return false;
        if (/<!doctype html|<html[\s>]/i.test(text)) return true;
        if (/^[\s]*({|\[)[\s\S]*?(}|\])[\s]*$/m.test(text)) return true; // Likely JSON

        let hits = 0;
        if (/\bfunction\s+[A-Za-z_$][\w$]*\s*\(/.test(text)) hits++;
        if (/\bclass\s+[A-Za-z_$][\w$]*/.test(text)) hits++;
        if (/\b(const|let|var)\s+[A-Za-z_$][\w$]*\s*=/.test(text)) hits++;
        if (/\bimport\s+.+\s+from\s+['"]/.test(text)) hits++;
        if (/\bexport\s+(default|const|function|class)\b/.test(text)) hits++;
        if (/[{};][ \t]*$/m.test(text)) hits++;
        if (/\b(if|for|while|switch|return)\b/.test(text)) hits++;

        if (hits >= 2) return true;
        return this._looksStructuredCode(text);
    }

    _scoreCandidate(text, path) {
        let score = Math.min(Math.floor(text.length / 40), 90);
        const lower = text.toLowerCase();
        const isPatch = this._isPatchText(text);

        if (path && /(code|content|artifact|patch|diff|file|toolcall)/i.test(path)) score += 45;
        if (/<!doctype html|<html[\s>]/i.test(text)) score += 120;
        if (isPatch) score -= 50;
        if (/\bfunction\s+[A-Za-z_$]/.test(text)) score += 55;
        if (/\bclass\s+[A-Za-z_$]/.test(text)) score += 45;
        if (/\b(const|let|var)\s+[A-Za-z_$]/.test(text)) score += 35;
        if (/\b(plan|step|todo|pull request)\b/.test(lower)) score -= 20;

        return score;
    }

    _pushCandidate(candidates, value, path) {
        const text = this._safeString(value);
        if (!text || text.length < 10) return;

        const baseIsPatch = this._isPatchText(text);
        candidates.push({
            text,
            path,
            score: this._scoreCandidate(text, path),
            isPatch: baseIsPatch
        });

        const fencedBlocks = this._extractMarkdownCodeBlocks(text);
        fencedBlocks.forEach((block, idx) => {
            const blockPath = `${path || 'candidate'}.fenced[${idx}]`;
            candidates.push({
                text: block,
                path: blockPath,
                score: this._scoreCandidate(block, blockPath) + 80,
                isPatch: this._isPatchText(block)
            });
        });
    }

    _sanitizeFilePath(pathValue) {
        const raw = this._safeString(pathValue);
        if (!raw) return '';
        return raw
            .replace(/\\/g, '/')
            .replace(/^\/+/, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    _isLikelyFilePath(pathValue) {
        const filePath = this._sanitizeFilePath(pathValue);
        if (!filePath || filePath.length > 240) return false;
        if (/^https?:\/\//i.test(filePath)) return false;
        if (/\s{2,}/.test(filePath)) return false;
        if (/[<>:"|?*]/.test(filePath)) return false;
        if (!/[./]/.test(filePath) || /\n/.test(filePath)) return false;

        const lower = filePath.toLowerCase();
        if (/^(session|sessions|activity|activities|output|outputs)\//.test(lower)) return false;

        const fileName = filePath.split('/').filter(Boolean).pop() || '';
        const hasExtension = /\.[a-z0-9][a-z0-9._-]{0,15}$/i.test(fileName);
        const knownNoExtension = /^(dockerfile|makefile|jenkinsfile|procfile|gemfile|rakefile|readme|license|copying)$/i.test(fileName);

        if (!hasExtension && !knownNoExtension) return false;
        return true;
    }

    _extractProjectFiles(sessionData) {
        const filesByPath = new Map();
        const visited = new WeakSet();

        const addFile = (pathValue, contentValue, sourcePath = '') => {
            const filePath = this._sanitizeFilePath(pathValue);
            const content = this._safeString(contentValue);

            if (!this._isLikelyFilePath(filePath)) return;
            if (!content || content.length < 6) return;
            if (this._isPatchText(content)) return;

            filesByPath.set(filePath, { path: filePath, content, sourcePath });
        };

        const tryObjectAsFile = (obj, sourcePath = '') => {
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;

            const pathKey = ['path', 'filePath', 'filepath', 'relativePath', 'targetPath', 'file', 'filename', 'name']
                .find(key => typeof obj[key] === 'string' && this._isLikelyFilePath(obj[key]));
            const contentKey = ['fileContent', 'text_content', 'content', 'text', 'code', 'source']
                .find(key => typeof obj[key] === 'string' && this._safeString(obj[key]).length > 0);

            if (pathKey && contentKey) {
                addFile(obj[pathKey], obj[contentKey], `${sourcePath}.${pathKey}/${contentKey}`);
            }
        };

        const walk = (value, sourcePath = 'session') => {
            if (value === null || value === undefined) return;

            if (typeof value !== 'object') return;
            if (visited.has(value)) return;
            visited.add(value);

            if (Array.isArray(value)) {
                value.forEach((item, idx) => walk(item, `${sourcePath}[${idx}]`));
                return;
            }

            tryObjectAsFile(value, sourcePath);

            if (value.files && typeof value.files === 'object') {
                if (Array.isArray(value.files)) {
                    value.files.forEach((item, idx) => walk(item, `${sourcePath}.files[${idx}]`));
                } else {
                    Object.entries(value.files).forEach(([filePath, fileContent]) => {
                        if (typeof fileContent === 'string') {
                            addFile(filePath, fileContent, `${sourcePath}.files.${filePath}`);
                        } else {
                            walk(fileContent, `${sourcePath}.files.${filePath}`);
                        }
                    });
                }
            }

            Object.entries(value).forEach(([key, nested]) => {
                if (key === 'files') return;
                walk(nested, `${sourcePath}.${key}`);
            });
        };

        walk(sessionData, 'session');
        return [...filesByPath.values()];
    }

    _formatProjectFiles(projectFiles) {
        if (!Array.isArray(projectFiles) || projectFiles.length === 0) {
            return { code: '', sourcePath: '', fileCount: 0 };
        }

        const maxFiles = 25;
        const files = projectFiles.slice(0, maxFiles).sort((a, b) => a.path.localeCompare(b.path));

        const chunks = files.map(file => `// FILE: ${file.path}\n${file.content}`);
        let code = chunks.join('\n\n');
        const maxChars = 90000;
        if (code.length > maxChars) {
            code = `${code.slice(0, maxChars)}\n\n// ... output truncated`;
        }

        const sourcePath = files[0]?.sourcePath || 'session.files';
        return { code, sourcePath, fileCount: projectFiles.length };
    }

    _pickBestCandidate(candidates) {
        if (!Array.isArray(candidates) || candidates.length === 0) return null;
        return [...candidates].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (b.text?.length || 0) - (a.text?.length || 0);
        })[0];
    }

    _extractCodeFromSession(sessionData) {
        const candidates = [];
        const activities = Array.isArray(sessionData?.activities) ? sessionData.activities : [];

        for (let i = activities.length - 1; i >= 0; i--) {
            const act = activities[i] || {};

            if (Array.isArray(act.artifacts)) {
                act.artifacts.forEach((artifact, idx) => {
                    this._pushCandidate(candidates, artifact?.text_content, `activities[${i}].artifacts[${idx}].text_content`);
                    this._pushCandidate(candidates, artifact?.content, `activities[${i}].artifacts[${idx}].content`);
                    this._pushCandidate(candidates, artifact?.fileContent, `activities[${i}].artifacts[${idx}].fileContent`);
                    this._pushCandidate(candidates, artifact?.gitPatch, `activities[${i}].artifacts[${idx}].gitPatch`);
                    this._pushCandidate(candidates, artifact?.patch, `activities[${i}].artifacts[${idx}].patch`);
                });
            }

            if (act.changeSet) {
                this._pushCandidate(candidates, act.changeSet.gitPatch, `activities[${i}].changeSet.gitPatch`);
                this._pushCandidate(candidates, act.changeSet.patch, `activities[${i}].changeSet.patch`);
                this._pushCandidate(candidates, act.changeSet.diff, `activities[${i}].changeSet.diff`);
            }

            const args = this._parseToolCallArgs(act.toolCall);
            if (args) {
                this._pushCandidate(candidates, args.content, `activities[${i}].toolCall.arguments.content`);
                this._pushCandidate(candidates, args.code, `activities[${i}].toolCall.arguments.code`);
                this._pushCandidate(candidates, args.patch, `activities[${i}].toolCall.arguments.patch`);
                this._pushCandidate(candidates, args.raw, `activities[${i}].toolCall.arguments.raw`);
            }
        }

        const outputs = Array.isArray(sessionData?.outputs) ? sessionData.outputs : [];
        outputs.forEach((output, idx) => {
            this._pushCandidate(candidates, output?.content, `outputs[${idx}].content`);
            this._pushCandidate(candidates, output?.text, `outputs[${idx}].text`);
            this._pushCandidate(candidates, output?.gitPatch, `outputs[${idx}].gitPatch`);
            this._pushCandidate(candidates, output?.patch, `outputs[${idx}].patch`);
        });

        const projectFiles = this._extractProjectFiles(sessionData);

        if (candidates.length === 0 && projectFiles.length === 0) {
            return { code: '', codeType: null, sourcePath: '' };
        }

        const likelyCodeCandidates = candidates.filter(c => !c.isPatch && this._isLikelyCode(c.text));
        const nonPatchCandidates = candidates.filter(c => !c.isPatch);
        const patchCandidates = candidates.filter(c => c.isPatch);

        const bestCodeCandidate = this._pickBestCandidate(likelyCodeCandidates);

        if (bestCodeCandidate) {
            return {
                code: bestCodeCandidate.text.trim(),
                codeType: 'code',
                sourcePath: bestCodeCandidate.path
            };
        }

        if (projectFiles.length) {
            const formattedProject = this._formatProjectFiles(projectFiles);
            if (formattedProject.code) {
                return {
                    code: formattedProject.code,
                    codeType: formattedProject.fileCount > 1 ? 'project' : 'code',
                    sourcePath: formattedProject.sourcePath
                };
            }
        }

        const fallbackStructuredCandidate = this._pickBestCandidate(
            nonPatchCandidates.filter(c => this._looksStructuredCode(c.text))
        );
        if (fallbackStructuredCandidate) {
            return {
                code: fallbackStructuredCandidate.text.trim(),
                codeType: 'code',
                sourcePath: fallbackStructuredCandidate.path
            };
        }

        const bestPatchCandidate = this._pickBestCandidate(patchCandidates);
        if (bestPatchCandidate) {
            return {
                code: bestPatchCandidate.text.trim(),
                codeType: 'patch',
                sourcePath: bestPatchCandidate.path
            };
        }

        return { code: '', codeType: null, sourcePath: '' };
    }

    extractPreview(sessionData) {
        if (!sessionData) return '';
        const extracted = this._extractCodeFromSession(sessionData);
        if (extracted.code) return extracted.code;

        // Deep fallback: just find the longest non-patch thing that looks like text
        const found = [];
        const visited = new WeakSet();
        const walk = (val) => {
            if (!val || typeof val !== 'object' || visited.has(val)) return;
            visited.add(val);
            if (Array.isArray(val)) {
                val.forEach(walk);
            } else {
                Object.values(val).forEach(v => {
                    if (typeof v === 'string' && v.length > 50 && !this._isPatchText(v)) {
                        found.push(v);
                    } else {
                        walk(v);
                    }
                });
            }
        };
        walk(sessionData);
        if (found.length === 0) return '';
        return found.sort((a, b) => b.length - a.length)[0];
    }

    _extractPullRequest(sessionData) {
        const outputs = Array.isArray(sessionData?.outputs) ? sessionData.outputs : [];
        for (const output of outputs) {
            if (output?.pullRequest) {
                return {
                    url: output.pullRequest.url || '',
                    title: output.pullRequest.title || '',
                    description: output.pullRequest.description || ''
                };
            }
        }
        return null;
    }

    _extractUrls(text) {
        if (!text || typeof text !== 'string') return [];
        const matches = text.match(/https?:\/\/[^\s<>"'`]+/g) || [];
        return [...new Set(matches.map(url => url.replace(/[),.;]+$/g, '')))];
    }

    _extractZipDownload(sessionData) {
        const visited = new WeakSet();
        const candidates = new Map();

        const scoreUrl = (url, path) => {
            let score = 0;
            if (/\.(zip)(?:$|[?#])/i.test(url)) score += 120;
            if (/[?&](format|type|ext)=zip(?:$|[&#])/i.test(url)) score += 100;
            if (/\/zip(?:$|[/?#])/i.test(url)) score += 60;
            if (/(download|archive|artifact|bundle|zip)/i.test(url)) score += 45;
            if (/(download|archive|artifact|bundle|zip)/i.test(path || '')) score += 65;
            return score;
        };

        const addUrlCandidate = (url, path) => {
            const safeUrl = this._safeString(url);
            if (!safeUrl || !/^https?:\/\//i.test(safeUrl)) return;

            const score = scoreUrl(safeUrl, path);
            if (score <= 0) return;

            const existing = candidates.get(safeUrl);
            if (!existing || score > existing.score) {
                candidates.set(safeUrl, { url: safeUrl, path, score });
            }
        };

        const walk = (value, path = '') => {
            if (value === null || value === undefined) return;

            if (typeof value === 'string') {
                const urls = this._extractUrls(value);
                urls.forEach(url => addUrlCandidate(url, path));
                return;
            }

            if (typeof value !== 'object') return;
            if (visited.has(value)) return;
            visited.add(value);

            if (Array.isArray(value)) {
                value.forEach((item, idx) => walk(item, `${path}[${idx}]`));
                return;
            }

            Object.entries(value).forEach(([key, val]) => {
                walk(val, path ? `${path}.${key}` : key);
            });
        };

        walk(sessionData, 'session');

        if (candidates.size === 0) return null;
        const best = [...candidates.values()].sort((a, b) => b.score - a.score)[0];
        return { url: best.url, sourcePath: best.path || '' };
    }

    _extractChatHistory(sessionData) {
        const history = [];
        const seen = new Set();

        const addMessage = (text, type = 'status') => {
            const clean = this._safeString(text);
            if (clean && !seen.has(clean)) {
                history.push({ text: clean, type });
                seen.add(clean);
            }
        };

        const activities = Array.isArray(sessionData?.activities) ? sessionData.activities : [];
        activities.forEach(act => {
            if (act.planGenerated) {
                const plan = this._extractPlanFromActivities([act]);
                if (plan) addMessage(plan, 'plan');
            }
            if (act.progressUpdated?.title) {
                addMessage(act.progressUpdated.title, 'progress');
            }
            // Check for agent feedback/comments in tool outputs or activities
            if (act.toolOutput?.output) {
                addMessage(act.toolOutput.output, 'output');
            }
        });

        const outputs = Array.isArray(sessionData?.outputs) ? sessionData.outputs : [];
        outputs.forEach(out => {
            if (out.text) addMessage(out.text, 'text');
            if (out.content) addMessage(out.content, 'content');
        });

        return history;
    }

    _composeResultMessage(result) {
        if (result.chatHistory && result.chatHistory.length > 0) {
            return result.chatHistory.map(m => m.text).join('\n\n').trim();
        }

        const parts = [];
        if (result.plan) {
            parts.push(`Agent Plan:\n${result.plan}`);
        }
        if (result.pullRequest && result.pullRequest.url) {
            let prText = result.pullRequest.title
                ? `**${result.pullRequest.title}**\n${result.pullRequest.url}`
                : `Pull Request Created: ${result.pullRequest.url}`;
            if (result.pullRequest.description) {
                prText += `\n\n${result.pullRequest.description}`;
            }
            parts.push(prText);
        }
        if (result.zipDownload?.url) {
            parts.push(`Download ZIP: ${result.zipDownload.url}`);
        }
        if (result.codeType === 'patch') {
            parts.push('Agent returned a patch/diff. Full final code was not detected in this response.');
        }
        if (!result.code && result.completed && parts.length === 0) {
            parts.push('Task completed successfully. (No direct code output detected)');
        }
        if (!result.completed) {
            parts.push('Task timed out or is still processing in background.');
        }
        return parts.join('\n\n').trim();
    }

    async runTaskDetailed(prompt, onStatusUpdate) {
        try {
            if (onStatusUpdate) onStatusUpdate('Initializing Agent...');

            // Keep this null for now to avoid source binding errors in hosted usage.
            let sourceContext = null;

            const session = await this.createSession(prompt, sourceContext);
            const sessionId = session?.name;
            if (!sessionId) {
                throw new Error('Jules session did not return a valid session id.');
            }
            this.currentSessionId = sessionId;

            if (onStatusUpdate) onStatusUpdate('Planning...');

            let completed = false;
            let planApproved = false;
            let finalResult = null;
            let latestSessionWithOutputs = null;
            let generatedPlan = '';
            let pollCount = 0;
            let lastStatus = '';
            let stableOutputPolls = 0;
            let lastOutputSignature = '';

            while (!completed && pollCount < 120) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const currentSession = await this.getSession(sessionId);
                if (currentSession?.error) {
                    throw new Error(currentSession.error.message || 'Failed to retrieve session state.');
                }

                const activities = Array.isArray(currentSession?.activities) ? currentSession.activities : [];
                const latestActivity = activities[activities.length - 1];
                const outputs = Array.isArray(currentSession?.outputs) ? currentSession.outputs : [];
                if (outputs.length > 0) {
                    latestSessionWithOutputs = currentSession;
                }

                const latestPlan = this._extractPlanFromActivities(activities);
                if (latestPlan) generatedPlan = latestPlan;

                if (!planApproved && activities.some(act => !!act?.planGenerated)) {
                    const status = 'Plan generated. Auto-approving...';
                    if (onStatusUpdate && status !== lastStatus) {
                        onStatusUpdate(status);
                        lastStatus = status;
                    }
                    await this.approvePlan(sessionId);
                    planApproved = true;
                }

                if (latestActivity?.progressUpdated?.title) {
                    const status = latestActivity.progressUpdated.title;
                    if (onStatusUpdate && status !== lastStatus) {
                        onStatusUpdate(status);
                        lastStatus = status;
                    }
                } else if (latestActivity?.sessionCompleted) {
                    completed = true;
                    finalResult = currentSession;
                    if (onStatusUpdate && lastStatus !== 'Completed') {
                        onStatusUpdate('Completed');
                        lastStatus = 'Completed';
                    }
                }
                const outputSignature = `${outputs.length}|${activities.length}|${latestActivity?.progressUpdated?.title || ''}|${!!latestActivity?.sessionCompleted}`;
                if (outputs.length > 0) {
                    if (outputSignature === lastOutputSignature) {
                        stableOutputPolls += 1;
                    } else {
                        stableOutputPolls = 0;
                        lastOutputSignature = outputSignature;
                    }
                } else {
                    stableOutputPolls = 0;
                    lastOutputSignature = '';
                }

                // Some sessions provide outputs before setting sessionCompleted.
                if (!completed && outputs.length > 0 && stableOutputPolls >= 4) {
                    completed = true;
                    finalResult = currentSession;
                }

                pollCount++;
            }

            if (!finalResult) {
                if (latestSessionWithOutputs) {
                    finalResult = latestSessionWithOutputs;
                    completed = true;
                }
            }

            if (!finalResult) {
                const timeoutResult = {
                    ok: true,
                    completed: false,
                    timedOut: true,
                    sessionId,
                    code: '',
                    codeType: null,
                    sourcePath: '',
                    plan: generatedPlan,
                    pullRequest: null,
                    zipDownload: null,
                    message: '',
                    raw: null
                };
                timeoutResult.message = this._composeResultMessage(timeoutResult);
                return timeoutResult;
            }

            const extractedCode = this._extractCodeFromSession(finalResult);
            const pullRequest = this._extractPullRequest(finalResult);
            const zipDownload = this._extractZipDownload(finalResult);

            const result = {
                ok: true,
                completed: true,
                timedOut: false,
                sessionId,
                code: extractedCode.code || '',
                codeType: extractedCode.codeType || null,
                sourcePath: extractedCode.sourcePath || '',
                plan: generatedPlan,
                chatHistory: this._extractChatHistory(finalResult),
                pullRequest,
                zipDownload,
                message: '',
                raw: finalResult
            };
            result.message = this._composeResultMessage(result);
            return result;
        } catch (error) {
            return {
                ok: false,
                completed: false,
                timedOut: false,
                sessionId: this.currentSessionId,
                code: '',
                codeType: null,
                sourcePath: '',
                plan: '',
                pullRequest: null,
                zipDownload: null,
                message: `Error: ${error.message}`,
                raw: null
            };
        }
    }

    async runTask(prompt, onStatusUpdate) {
        const result = await this.runTaskDetailed(prompt, onStatusUpdate);
        if (!result.ok) return result.message;
        if (result.code && (result.codeType === 'code' || result.codeType === 'project')) return result.code;
        if (result.message) return result.message;
        return 'Task completed.';
    }

    // Backward-compatible helper retained for existing callers.
    extractPreview(sessionData) {
        const extracted = this._extractCodeFromSession(sessionData || {});
        if (extracted.code) {
            return extracted.code;
        }
        return null;
    }
}

// Export a singleton instance.
// API key must be provided at runtime (settings/local config), never hardcoded in repository.
const julesClient = new JulesClient('');
// Attach to window for global access
if (typeof window !== 'undefined') {
    window.julesClient = julesClient;
}
