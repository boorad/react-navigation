import * as React from 'react';
import { useNavigation, useRoute, EventArg } from '@react-navigation/core';

type ScrollOptions = { y?: number; animated?: boolean };

type ScrollableView =
  | { scrollToTop(): void }
  | { scrollTo(options: ScrollOptions): void }
  | { scrollToOffset(options: { offset?: number; animated?: boolean }): void }
  | { scrollResponderScrollTo(options: ScrollOptions): void };

type ScrollableWrapper =
  | { getScrollResponder(): React.ReactNode }
  | ScrollableView;

function getScrollableNode(ref: React.RefObject<ScrollableWrapper>) {
  if (ref.current == null) {
    return null;
  }

  if (
    'scrollToTop' in ref.current ||
    'scrollTo' in ref.current ||
    'scrollToOffset' in ref.current ||
    'scrollResponderScrollTo' in ref.current
  ) {
    // This is already a scrollable node.
    return ref.current;
  } else if ('getScrollResponder' in ref.current) {
    // If the view is a wrapper like FlatList, SectionList etc.
    // We need to use `getScrollResponder` to get access to the scroll responder
    return ref.current.getScrollResponder();
  } else {
    return ref.current;
  }
}

export default function useScrollToTop(
  ref: React.RefObject<ScrollableWrapper>
) {
  const navigation = useNavigation();
  const route = useRoute();

  React.useEffect(() => {
    let current = navigation;

    // The screen might be inside another navigator such as stack nested in tabs
    // We need to find the closest tab navigator and add the listener there
    while (current && current.dangerouslyGetState().type !== 'tab') {
      current = current.dangerouslyGetParent();
    }

    if (!current) {
      return;
    }

    const unsubscribe = current.addListener(
      // We don't wanna import tab types here to avoid extra deps
      // in addition, there are multiple tab implementations
      // @ts-ignore
      'tabPress',
      (e: EventArg<'tabPress', true>) => {
        // We should scroll to top only when the screen is focused
        const isFocused = navigation.isFocused();

        // In a nested stack navigator, tab press resets the stack to first screen
        // So we should scroll to top only when we are on first screen
        const isFirst =
          navigation === current ||
          navigation.dangerouslyGetState().routes[0].key === route.key;

        // Run the operation in the next frame so we're sure all listeners have been run
        // This is necessary to know if preventDefault() has been called
        requestAnimationFrame(() => {
          const scrollable = getScrollableNode(ref) as ScrollableWrapper;

          if (isFocused && isFirst && scrollable && !e.defaultPrevented) {
            if ('scrollToTop' in scrollable) {
              scrollable.scrollToTop();
            } else if ('scrollTo' in scrollable) {
              scrollable.scrollTo({ y: 0, animated: true });
            } else if ('scrollToOffset' in scrollable) {
              scrollable.scrollToOffset({ offset: 0, animated: true });
            } else if ('scrollResponderScrollTo' in scrollable) {
              scrollable.scrollResponderScrollTo({ y: 0, animated: true });
            }
          }
        });
      }
    );

    return unsubscribe;
  }, [navigation, ref, route.key]);
}
