require 'xcodeproj'

project_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)
target = project.targets.first
resources_phase = target.resources_build_phase

# Fazlalık olan dosyayı bulalım (ios/App/GoogleService-Info.plist)
# Xcode'da dosya referansları genellikle dosya ismine göre tutulur ama full path de önemlidir.
# Hepsini tarayıp duplicate'leri temizleyeceğiz.

items_to_remove = []

resources_phase.files.each do |build_file|
  next unless build_file.file_ref
  
  if build_file.file_ref.name == 'GoogleService-Info.plist' || build_file.file_ref.path.include?('GoogleService-Info.plist')
    puts "Found GoogleService-Info.plist in build phase. Path: #{build_file.file_ref.path}"
    
    # Eğer path "App/GoogleService-Info.plist" ise (bizim istediğimiz bu), Dokunma.
    # Eğer path sadece "GoogleService-Info.plist" ise (root'taki), SİL.
    
    if build_file.file_ref.path == 'GoogleService-Info.plist'
       puts "Marking root GoogleService-Info.plist for removal..."
       items_to_remove << build_file
    end
  end
end

if items_to_remove.empty?
  puts "Auto-detection failed or no duplicates found strictly by path name."
  puts "Removing ALL references and re-adding ONLY the correct one (App/GoogleService-Info.plist)."
  
  # Temizle
  resources_phase.files.each do |f|
    if f.file_ref && (f.file_ref.name == 'GoogleService-Info.plist' || f.file_ref.path.include?('GoogleService-Info.plist'))
      resources_phase.remove_build_file(f)
    end
  end
  
  # Doğrusunu ekle
  group = project.main_group['App']
  file_ref = group.files.find { |f| f.path == 'GoogleService-Info.plist' } # App grubunun içindeki relative path
  
  if file_ref
    resources_phase.add_file_reference(file_ref)
    puts "Re-added App/GoogleService-Info.plist correctly."
  else
    puts "Could not find reference for App/GoogleService-Info.plist in the group."
  end
  
else
  items_to_remove.each do |f|
    resources_phase.remove_build_file(f)
    puts "Removed duplicate build file."
  end
end

project.save
puts "Project saved and cleaned."
