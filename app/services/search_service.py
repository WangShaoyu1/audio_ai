import logging
from typing import List, Dict, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class SearchService:
    def __init__(self):
        self.provider = settings.SEARCH_PROVIDER.lower()
        logger.info(f"Initializing SearchService with provider: {self.provider}")

    async def search(self, query: str, max_results: int = 5) -> List[Dict[str, str]]:
        """
        Execute search based on configured provider.
        Returns a list of dicts: [{'title': '...', 'href': '...', 'body': '...'}]
        """
        if self.provider == "duckduckgo":
            return await self._search_duckduckgo(query, max_results)
        elif self.provider == "tavily":
            return await self._search_tavily(query, max_results)
        elif self.provider == "serper":
            return await self._search_serper(query, max_results)
        else:
            logger.warning(f"Unknown search provider: {self.provider}, falling back to DuckDuckGo")
            return await self._search_duckduckgo(query, max_results)

    async def _search_duckduckgo(self, query: str, max_results: int) -> List[Dict[str, str]]:
        try:
            from duckduckgo_search import DDGS
            
            # DDGS is synchronous, so we might want to run it in a thread pool if it blocks too long
            # For now, we'll keep it simple as it's usually fast enough for demos
            results = []
            with DDGS() as ddgs:
                # text() returns a generator
                ddg_gen = ddgs.text(query, max_results=max_results)
                for r in ddg_gen:
                    results.append({
                        "title": r.get("title", ""),
                        "href": r.get("href", ""),
                        "body": r.get("body", "")
                    })
            return results
        except Exception as e:
            logger.error(f"DuckDuckGo search failed: {e}")
            return []

    async def _search_tavily(self, query: str, max_results: int) -> List[Dict[str, str]]:
        if not settings.TAVILY_API_KEY:
            logger.error("Tavily API Key is missing")
            return []
        
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": settings.TAVILY_API_KEY,
                        "query": query,
                        "search_depth": "basic",
                        "max_results": max_results
                    },
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                results = []
                for result in data.get("results", []):
                    results.append({
                        "title": result.get("title", ""),
                        "href": result.get("url", ""),
                        "body": result.get("content", "")
                    })
                return results
        except Exception as e:
            logger.error(f"Tavily search failed: {e}")
            return []

    async def _search_serper(self, query: str, max_results: int) -> List[Dict[str, str]]:
        if not settings.SERPER_API_KEY:
            logger.error("Serper API Key is missing")
            return []
            
        # Placeholder for Serper implementation
        logger.warning("Serper search not fully implemented yet")
        return []

# Global instance
search_service = SearchService()
