on run argv
  set modeName to "list"
  set targetText to ""
  if (count of argv) > 0 then set modeName to item 1 of argv
  if (count of argv) > 1 then set targetText to item 2 of argv

  tell application "System Events"
    tell process "Simulator"
      set elementsList to entire contents of window 1
      set outputText to ""
      if modeName is "bottom" then
        set outputText to "COUNT " & (count of elementsList) & linefeed
        repeat with elementIndex from 1 to count of elementsList
          set currentElement to item elementIndex of elementsList
          try
            set elementPosition to position of currentElement
            set elementSize to size of currentElement
            if item 2 of elementPosition > 500 then
              set roleText to role of currentElement as text
              set nameText to ""
              set valueText to ""
              try
                set nameText to name of currentElement as text
              end try
              try
                set valueText to value of currentElement as text
              end try
              set outputText to outputText & elementIndex & " | " & roleText & " | " & nameText & " | " & valueText & " | " & elementPosition & " | " & elementSize & linefeed
            end if
          end try
        end repeat
        return outputText
      end if
      repeat with currentElement in elementsList
        set currentElement to contents of currentElement
        set roleText to ""
        set nameText to ""
        set descriptionText to ""
        set titleText to ""
        set valueText to ""
        try
          set roleText to role of currentElement as text
        end try
        try
          set nameText to name of currentElement as text
        end try
        try
          set descriptionText to description of currentElement as text
        end try
        try
          set titleText to title of currentElement as text
        end try
        try
          set valueText to value of currentElement as text
        end try
        set searchableText to roleText & " | " & nameText & " | " & descriptionText & " | " & titleText & " | " & valueText
        try
          if modeName is "press" and searchableText contains targetText then
            perform action "AXPress" of currentElement
            return "PRESSED: " & searchableText
          end if
          if modeName is "list" and searchableText contains targetText then
            set outputText to outputText & searchableText & linefeed
          end if
        end try
      end repeat
      if modeName is "press" then error "Element not found: " & targetText
      return outputText
    end tell
  end tell
end run
