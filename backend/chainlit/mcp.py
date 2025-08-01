import shlex
from typing import Dict, Literal, Optional, Union

from pydantic import BaseModel

from chainlit.config import config


class StdioMcpConnection(BaseModel):
    name: str
    command: str
    args: list[str]
    clientType: Literal["stdio"] = "stdio"


class SseMcpConnection(BaseModel):
    name: str
    url: str
    headers: Optional[Dict[str, str]] = None
    clientType: Literal["sse"] = "sse"


class HttpMcpConnection(BaseModel):
    name: str
    url: str
    headers: Optional[Dict[str, str]] = None
    clientType: Literal["streamable-http"] = "streamable-http"


McpConnection = Union[StdioMcpConnection, SseMcpConnection, HttpMcpConnection]


def validate_mcp_command(command_string: str):
    """
    Validates that a command string uses command in the allowed list as the executable and returns
    the executable and list of arguments suitable for subprocess calls.

    This function handles potential command prefixes, flags, and options
    to ensure only commands in allowed list are allowed.

    Args:
        command_string (str): The full command string to validate

    Returns:
        tuple: (env, executable, args_list) where:
            - env (dict): Environment variables as a dictionary
            - executable (str): The executable name or path
            - args_list (list): List of command arguments

    Raises:
        ValueError: If the command doesn't use an allowed executable
    """
    # Split the command string into parts while respecting quotes and escapes
    # Using shlex.split provides POSIX-compatible parsing so that arguments
    # wrapped in quotes (e.g. "--header \"Authorization: Bearer TOKEN\"")
    # or environment variable assignments such as
    # MY_VAR="value with spaces" are preserved as single list items.
    # On Windows, shlex also works as long as posix=False is not required for
    # our use-case (Chainlit targets POSIX-style shells for the MCP command).
    try:
        parts = shlex.split(command_string, posix=True)
    except ValueError as exc:
        # Provide a clearer error message when the command cannot be parsed
        raise ValueError(f"Invalid command string: {exc}") from exc

    if not parts:
        raise ValueError("Empty command string")

    # Look for the actual executable in the command
    executable = None
    executable_index = None
    allowed_executables = config.features.mcp.stdio.allowed_executables
    for i, part in enumerate(parts):
        # Remove any path components to get the base executable name
        base_exec = part.split("/")[-1].split("\\")[-1]
        if allowed_executables is None or base_exec in allowed_executables:
            executable = part
            executable_index = i
            break

    if executable is None or executable_index is None:
        raise ValueError(
            f"Only commands in ({', '.join(allowed_executables)}) are allowed"
            if allowed_executables
            else "No allowed executables found"
        )

    # Return `executable` as the executable and everything after it as args
    args_list = parts[executable_index + 1 :]
    env_list = parts[:executable_index]
    env = {}
    for env_var in env_list:
        if "=" in env_var:
            key, value = env_var.split("=", 1)
            env[key] = value
        else:
            raise ValueError(f"Invalid environment variable format: {env_var}")

    return env, executable, args_list
