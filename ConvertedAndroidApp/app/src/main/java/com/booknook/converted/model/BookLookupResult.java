package com.booknook.converted.model;

import java.util.ArrayList;
import java.util.List;

public class BookLookupResult {
    public String id;
    public String title;
    public String author;
    public String coverUrl;
    public int firstPublishYear;
    public int pageCount;
    public int editionCount;
    public boolean hasReadableText;
    public String description;
    public final List<String> iaIds = new ArrayList<>();
}
