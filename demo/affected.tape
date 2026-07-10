# VerisKit — developer-loop demo: change one file, run only the tests that reach it.
Output assets/veriskit-affected.gif

Set Shell "bash"
Set FontSize 22
Set Width 1120
Set Height 620
Set Padding 28
Set TypingSpeed 55ms
Set Theme { "name": "veriskit", "background": "#08191C", "foreground": "#EAFAF6", "cursor": "#14B8A6", "selection": "#14384033", "black": "#0B2226", "red": "#F87171", "green": "#34D399", "yellow": "#FBBF24", "blue": "#60A5FA", "magenta": "#C084FC", "cyan": "#2DD4BF", "white": "#CFE8E3", "brightBlack": "#3B5B5B", "brightRed": "#FCA5A5", "brightGreen": "#5EEAD4", "brightYellow": "#FDE68A", "brightBlue": "#93C5FD", "brightMagenta": "#D8B4FE", "brightCyan": "#67E8F9", "brightWhite": "#EAFAF6" }

# Quiet setup: clean prompt, land in the repo, make a one-line edit to a leaf file, clear.
Hide
Type "cd '/Users/abhyoh/local dev folder/Apps/veris' && PS1='❯ ' && printf '\n// demo: touch a leaf module\n' >> src/reporters/markdown.ts && clear"
Enter
Sleep 400ms
Show

Sleep 800ms
Type "veris affected"
Sleep 700ms
Enter
Sleep 6s
Sleep 2500ms
