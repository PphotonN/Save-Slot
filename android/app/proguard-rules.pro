# kotlinx.serialization keeps generated serializers reachable via reflection-free lookup,
# but R8 still needs the companion serializer accessors preserved.
-keepclassmembers class com.saveslot.app.** {
    *** Companion;
}
-keepclasseswithmembers class com.saveslot.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
