from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class AppError(Exception):
    code: str
    status_code: int
    message: str
    fallback_recommended: bool = False

    def __str__(self) -> str:
        return self.code


def invalid_input() -> AppError:
    return AppError("INVALID_INPUT", 422, "The request did not match the operation contract.")


def output_rejected() -> AppError:
    return AppError(
        "OUTPUT_REJECTED",
        422,
        "The generated result did not pass Darin safety validation.",
        fallback_recommended=True,
    )
