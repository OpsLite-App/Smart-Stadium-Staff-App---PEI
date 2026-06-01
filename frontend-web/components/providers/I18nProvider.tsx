'use client';

import { useEffect } from 'react';
import i18n from '@/lib/i18n/config';
import { I18nextProvider } from 'react-i18next';
import { translateUiText, type SupportedLanguage } from '@/lib/i18n/uiText';

const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label'] as const;
const textSources = new WeakMap<Text, { source: string; rendered: string }>();
const attributeSources = new WeakMap<Element, Map<string, { source: string; rendered: string }>>();

function translateNode(root: Node, language: SupportedLanguage) {
  const textNodes: Text[] = [];
  const elements: Element[] = [];

  if (root.nodeType === Node.TEXT_NODE) textNodes.push(root as Text);
  if (root.nodeType === Node.ELEMENT_NODE) elements.push(root as Element);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) {
    if (walker.currentNode.nodeType === Node.TEXT_NODE) textNodes.push(walker.currentNode as Text);
    if (walker.currentNode.nodeType === Node.ELEMENT_NODE) elements.push(walker.currentNode as Element);
  }

  for (const node of textNodes) {
    if (node.parentElement?.closest('script, style')) continue;
    const cached = textSources.get(node);
    const source = !cached || cached.rendered !== node.data ? node.data : cached.source;
    const rendered = translateUiText(source, language);
    textSources.set(node, { source, rendered });
    if (node.data !== rendered) node.data = rendered;
  }

  for (const element of elements) {
    const cached = attributeSources.get(element) ?? new Map();
    for (const attribute of TRANSLATABLE_ATTRIBUTES) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const previous = cached.get(attribute);
      const source = !previous || previous.rendered !== current ? current : previous.source;
      const rendered = translateUiText(source, language);
      cached.set(attribute, { source, rendered });
      if (current !== rendered) element.setAttribute(attribute, rendered);
    }
    attributeSources.set(element, cached);
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      const language: SupportedLanguage = lng === 'en' ? 'en' : 'pt';
      document.documentElement.lang = language === 'pt' ? 'pt-PT' : 'en';
      translateNode(document.body, language);
    };

    handleLanguageChanged(i18n.language);
    i18n.on('languageChanged', handleLanguageChanged);
    const observer = new MutationObserver((mutations) => {
      const language: SupportedLanguage = i18n.language === 'en' ? 'en' : 'pt';
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') translateNode(mutation.target, language);
        mutation.addedNodes.forEach((node) => translateNode(node, language));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  );
}
