from fastapi import FastAPI

app = FastAPI(title="Student Results Portal")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
