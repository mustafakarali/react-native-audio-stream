cmake_minimum_required(VERSION 3.13)
set(CMAKE_VERBOSE_MAKEFILE on)

add_compile_options(
    -fexceptions
    -frtti
    -std=c++17
    -Wall
    -Wpedantic
)

file(GLOB audiostream_SRCS CONFIGURE_DEPENDS *.cpp)
file(GLOB audiostream_HDRS CONFIGURE_DEPENDS *.h)

# Define the library
add_library(
    react_codegen_RNAudioStreamSpec
    SHARED
    ${audiostream_SRCS}
)

# Include directories
target_include_directories(
    react_codegen_RNAudioStreamSpec
    PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
)

# Link libraries
target_link_libraries(
    react_codegen_RNAudioStreamSpec
    fbjni
    folly_runtime
    glog
    jsi
    react_codegen_rncore
    react_debug
    react_nativemodule_core
    react_render_core
    react_render_debug
    react_render_graphics
    react_render_mapbuffer
    rrc_view
    turbomodulejsijni
    yoga
) 