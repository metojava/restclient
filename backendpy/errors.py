from http import HTTPStatus


class ApiError(Exception):
    """An error that should be returned to the client with a specific HTTP status."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message

    @property
    def phrase(self) -> str:
        try:
            return HTTPStatus(self.status).phrase
        except ValueError:
            return "Error"
