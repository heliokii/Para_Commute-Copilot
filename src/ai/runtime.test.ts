import { beforeEach, describe, expect, it, vi } from 'vitest'

const webllm = vi.hoisted(() => ({
  hasModelInCache: vi.fn<(modelId: string) => Promise<boolean>>(),
  CreateMLCEngine: vi.fn(async () => ({ unload: async () => {} })),
}))
vi.mock('@mlc-ai/web-llm', () => webllm)

import { loadModel, unloadModel } from './runtime.ts'

// CreateMLCEngine is the only call that can download a model.
describe('loadModel', () => {
  beforeEach(async () => {
    await unloadModel()
    vi.clearAllMocks()
  })

  it('refuses a model that is not in the cache when downloading is not allowed', async () => {
    webllm.hasModelInCache.mockResolvedValue(false)
    await expect(loadModel('some-model', undefined, false)).rejects.toThrow('not in the local cache')
    expect(webllm.CreateMLCEngine).not.toHaveBeenCalled()
  })

  it('loads a cached model when downloading is not allowed', async () => {
    webllm.hasModelInCache.mockResolvedValue(true)
    await loadModel('some-model', undefined, false)
    expect(webllm.CreateMLCEngine).toHaveBeenCalledTimes(1)
  })

  it('does not load a model twice', async () => {
    webllm.hasModelInCache.mockResolvedValue(true)
    await loadModel('some-model', undefined, false)
    await loadModel('some-model', undefined, false)
    expect(webllm.CreateMLCEngine).toHaveBeenCalledTimes(1)
  })

  it('may download only when the caller allows it (the Setup button)', async () => {
    webllm.hasModelInCache.mockResolvedValue(false)
    await loadModel('some-model')
    expect(webllm.CreateMLCEngine).toHaveBeenCalledTimes(1)
  })
})
