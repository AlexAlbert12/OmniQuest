const RENDERABLE_AVATAR_URI = /^(?:https?:\/\/|data:image\/|blob:|file:|content:)/i

export function getRenderableAvatarUri(value: string | null | undefined) {
  const normalized = value?.trim() || ''
  return normalized && RENDERABLE_AVATAR_URI.test(normalized) ? normalized : null
}
