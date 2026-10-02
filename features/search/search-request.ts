/**
 * Lets other surfaces open the header's search without mounting a second
 * GlobalSearch, which would register its own Command-K listener.
 */
const SEARCH_REQUEST_EVENT = 'cultural-alignment:open-search'

export function requestGlobalSearch() {
  window.dispatchEvent(new Event(SEARCH_REQUEST_EVENT))
}

export function onGlobalSearchRequest(listener: () => void) {
  window.addEventListener(SEARCH_REQUEST_EVENT, listener)
  return () => window.removeEventListener(SEARCH_REQUEST_EVENT, listener)
}
