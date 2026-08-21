from os import environ
from pathlib import Path
from platform import machine, system

from setuptools import Distribution, Extension, find_packages, setup
from wheel.bdist_wheel import bdist_wheel


class BinaryDistribution(Distribution):
    def has_ext_modules(self):
        return True


class BdistWheel(bdist_wheel):
    def get_tag(self):
        python, abi, platform = super().get_tag()
        if python.startswith("cp"):
            python, abi = "cp39", "abi3"
        return python, abi, platform


prebuilt_windows_binding = (
    environ.get("TREE_SITTER_UE_CPP_FORCE_BUILD") != "1"
    and system() == "Windows"
    and machine().lower() in {"amd64", "x86_64"}
    and Path(
        "bindings/python/tree_sitter_ue_cpp/_binding.pyd"
    ).is_file()
)
ext_modules = []
if not prebuilt_windows_binding:
    ext_modules.append(
        Extension(
            name="tree_sitter_ue_cpp._binding",
            sources=[
                "bindings/python/tree_sitter_ue_cpp/binding.c",
                "src/parser.c",
                "src/scanner.c",
            ],
            extra_compile_args=(
                ["/std:c11", "/utf-8"]
                if system() == "Windows"
                else ["-std=c11", "-fvisibility=hidden"]
            ),
            define_macros=[
                ("Py_LIMITED_API", "0x03090000"),
                ("PY_SSIZE_T_CLEAN", None),
                ("TREE_SITTER_HIDE_SYMBOLS", None),
            ],
            include_dirs=["src"],
            py_limited_api=True,
        )
    )


setup(
    packages=find_packages("bindings/python"),
    package_dir={"": "bindings/python"},
    package_data={"tree_sitter_ue_cpp": ["*.pyd", "*.pyi", "py.typed"]},
    ext_modules=ext_modules,
    distclass=BinaryDistribution,
    cmdclass={"bdist_wheel": BdistWheel},
    zip_safe=False,
)
