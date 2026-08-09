module.exports = function omniQuestLocalizeUiText({ types: t }) {
  return {
    name: 'omniquest-localize-ui-text',
    visitor: {
      Program: {
        enter(path, state) {
          const filename = String(state.filename || state.file?.opts?.filename || '')
          state.oqSkipLocalization = /(?:node_modules|\.expo|supabase[\\/]functions)|LocalizedPrimitives\.(t|j)sx?$/.test(filename)
          state.oqTextLocals = new Set()
          state.oqTextInputLocals = new Set()
          state.oqLocalizedTextName = path.scope.generateUidIdentifier('OQLocalizedText')
          state.oqLocalizedTextInputName = path.scope.generateUidIdentifier('OQLocalizedTextInput')
          state.oqDidTransformText = false
          state.oqDidTransformTextInput = false
          if (state.oqSkipLocalization) return
          for (const node of path.node.body) {
            if (!t.isImportDeclaration(node) || node.source.value !== 'react-native') continue
            for (const specifier of node.specifiers) {
              if (!t.isImportSpecifier(specifier)) continue
              const imported = t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value
              if (imported === 'Text') state.oqTextLocals.add(specifier.local.name)
              if (imported === 'TextInput') state.oqTextInputLocals.add(specifier.local.name)
            }
          }
        },
        exit(path, state) {
          if (state.oqSkipLocalization || (!state.oqDidTransformText && !state.oqDidTransformTextInput)) return
          const specifiers = []
          if (state.oqDidTransformText) specifiers.push(t.importSpecifier(state.oqLocalizedTextName, t.identifier('LocalizedText')))
          if (state.oqDidTransformTextInput) specifiers.push(t.importSpecifier(state.oqLocalizedTextInputName, t.identifier('LocalizedTextInput')))
          path.node.body.unshift(t.importDeclaration(specifiers, t.stringLiteral('@/components/ui/LocalizedPrimitives')))
        },
      },
      JSXOpeningElement(path, state) {
        if (state.oqSkipLocalization || !t.isJSXIdentifier(path.node.name)) return
        if (state.oqTextLocals?.has(path.node.name.name)) {
          path.node.name = t.jsxIdentifier(state.oqLocalizedTextName.name)
          state.oqDidTransformText = true
        } else if (state.oqTextInputLocals?.has(path.node.name.name)) {
          path.node.name = t.jsxIdentifier(state.oqLocalizedTextInputName.name)
          state.oqDidTransformTextInput = true
        }
      },
      JSXClosingElement(path, state) {
        if (state.oqSkipLocalization || !t.isJSXIdentifier(path.node.name)) return
        if (state.oqTextLocals?.has(path.node.name.name)) {
          path.node.name = t.jsxIdentifier(state.oqLocalizedTextName.name)
        } else if (state.oqTextInputLocals?.has(path.node.name.name)) {
          path.node.name = t.jsxIdentifier(state.oqLocalizedTextInputName.name)
        }
      },
    },
  }
}
