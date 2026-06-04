// @types/react 19 moved the JSX namespace under `React.JSX` and dropped the global one.
// Libraries built against React 18 (e.g. @react-spring/web 9) still type their host
// elements via the global `JSX.IntrinsicElements` (which @react-three/fiber augments with
// three elements only). This bridge re-exposes React's JSX namespace globally so DOM host
// elements (animated.div, …) resolve, without changing the project's React 18 runtime.
import type * as React from 'react';

declare global {
  namespace JSX {
    type Element = React.JSX.Element;
    type ElementClass = React.JSX.ElementClass;
    type ElementAttributesProperty = React.JSX.ElementAttributesProperty;
    type ElementChildrenAttribute = React.JSX.ElementChildrenAttribute;
    type IntrinsicAttributes = React.JSX.IntrinsicAttributes;
    type IntrinsicClassAttributes<T> = React.JSX.IntrinsicClassAttributes<T>;
    type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>;
    // Merges with @react-three/fiber's global augmentation (which adds the three elements).
    interface IntrinsicElements extends React.JSX.IntrinsicElements {}
  }
}
