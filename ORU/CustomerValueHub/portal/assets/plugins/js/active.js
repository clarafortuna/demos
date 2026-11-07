// =========================================================================================
// * Project Name :  Expart - Technology & IT Solutions HTML Template
// * File         :  JS Base
// * Version      :  1.0.0
// * Author       :  PicmaticWeb (https://themeforest.net/user/picmaticweb)
// * Developer    :  Meheraj Hossain Sagar
// =========================================================================================

(function ($) {
  "use strict";
  $(document).on("ready", function () {
    /*======================================================================================
		  Header Sticky JS
	  =======================================================================================*/
    $(window).on("scroll", function (event) {
      var scroll = $(window).scrollTop();
      if (scroll < 100) {
        $(".header").removeClass("sticky");
      } else {
        $(".header").addClass("sticky");
      }
    });

    /*======================================================================================
      Mobile Menu JS
      =======================================================================================*/
    var $offcanvasNav = $("#offcanvas-menu a");
    $offcanvasNav.on("click", function () {
      var link = $(this);
      var closestUl = link.closest("ul");
      var activeLinks = closestUl.find(".active");
      var closestLi = link.closest("li");
      var linkStatus = closestLi.hasClass("active");
      var count = 0;

      closestUl.find("ul").slideUp(function () {
        if (++count == closestUl.find("ul").length)
          activeLinks.removeClass("active");
      });
      if (!linkStatus) {
        closestLi.children("ul").slideDown();
        closestLi.addClass("active");
      }
    });

    /*======================================================================================
      Wow JS
    =======================================================================================*/
    var window_width = $(window).width();
    if (window_width > 767) {
      new WOW().init();
    }

    /*======================================================================================
      CounterUp JS
   =======================================================================================*/
    function odometerPackage() {
      const odometerElements = document.querySelectorAll(".odometer");
      /**
       * Initializes odometer elements when they become visible in the viewport.
       *
       * @param {Array} entries - The array of IntersectionObserver entries.
       * @param {IntersectionObserver} observer - The IntersectionObserver instance.
       */
      function initOdometer(entries, observer) {
        // Loop through each IntersectionObserver entry
        entries.forEach((entry) => {
          // If the target element is visible in the viewport
          if (entry.isIntersecting) {
            // Select the odometer element within the target element
            const odometerElement = entry.target.querySelector(".odometer");
            // Get the value attribute from the odometer element
            const elementValue = Number(
              odometerElement.getAttribute("data-counter-value")
            );
            // Create a new Odometer instance
            const od = new Odometer({
              el: odometerElement, // Set the element to be the odometer element
              value: 0, // Set the initial value to 0
              format: "", // Use the default format
              theme: "digital", // Use the digital theme
            });
            // Update the odometer with the element value
            od.update(elementValue);
            // Stop observing the target element once it's initialized
            observer.unobserve(entry.target);
          }
        });
      }
      // Initialize IntersectionObserver for each odometer element
      odometerElements &&
        odometerElements.forEach((item) => {
          const observer = new IntersectionObserver(initOdometer);
          observer.observe(item.parentElement);
        });
    }
    odometerPackage();

    /*======================================================================================
      Nice Select JS
   =======================================================================================*/
    $("select").niceSelect();

    /*======================================================================================
      Video Popup JS
   =======================================================================================*/
    $(".popup-video").magnificPopup({
      type: "iframe",
    });

    /*======================================================================================
      Hobble Effect JS
   =======================================================================================*/
    function hobbleEffect() {
      $(document)
        .on("mousemove", ".hobble", function (event) {
          var halfW = this.clientWidth / 2;
          var halfH = this.clientHeight / 2;
          var coorX = halfW - (event.pageX - $(this).offset().left);
          var coorY = halfH - (event.pageY - $(this).offset().top);
          var degX1 = (coorY / halfH) * 8 + "deg";
          var degY1 = (coorX / halfW) * -8 + "deg";
          var degX3 = (coorY / halfH) * -15 + "px";
          var degY3 = (coorX / halfW) * 15 + "px";

          $(this)
            .find(".hover-layer-1")
            .css("transform", function () {
              return (
                "perspective( 800px ) translate3d( 0, 0, 0 ) rotateX(" +
                degX1 +
                ") rotateY(" +
                degY1 +
                ")"
              );
            });
          $(this)
            .find(".hover-layer-2")
            .css("transform", function () {
              return (
                "perspective( 800px ) translateX(" +
                degX3 +
                ") translateY(" +
                degY3 +
                ") scale(1.02)"
              );
            });
        })
        .on("mouseout", ".hobble", function () {
          $(this).find(".hover-layer-1").removeAttr("style");
          $(this).find(".hover-layer-2").removeAttr("style");
        });
    }
    hobbleEffect();

    /*======================================================================================
      Progress JS
    =======================================================================================*/
    // Function to animate progress bar fill and number count
    function animateProgress(container) {
      const percentage = parseInt(
        container.getAttribute("data-percentage"),
        10
      );
      const progressEl = container.querySelector(".progress");
      const percentageEl = container
        .closest(".progress-item")
        .querySelector(".progress-item-percentage"); // Correct span selection

      let current = 0; // Start from 0
      progressEl.style.width = "0%";
      percentageEl.innerText = "0%";

      const interval = setInterval(() => {
        if (current >= percentage) {
          clearInterval(interval); // Stop when target is reached
        } else {
          current++;
          progressEl.style.width = current + "%";
          percentageEl.innerText = current + "%"; // Update the number in UI
        }
      }, 5); // Adjust speed as needed
    }

    // Intersection Observer to trigger animation when in viewport
    function handleIntersection(entries) {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateProgress(entry.target);
          intObserver.unobserve(entry.target); // Unobserve after animation
        }
      });
    }

    // Create Intersection Observer
    const intObserver = new IntersectionObserver(handleIntersection, {
      root: null,
      threshold: 0.3,
    });

    // Get all progress containers and observe each one
    document.querySelectorAll(".progress-container").forEach((container) => {
      intObserver.observe(container);
    });

    /*======================================================================================
      Hero Slider JS
    =======================================================================================*/
    const $carousel = $(".hero-slider");
    const $progressBar = $(".progress");
    const $currentSlide = $(".current-slide");
    const $totalSlides = $(".total-slides");
    const $dotsContainer = $(".custom-dots");

    // Function to dynamically update total slides and dots
    function updateSliderMeta() {
      const totalSlides = $carousel.find(".owl-item").not(".cloned").length; // Exclude cloned slides
      $totalSlides.text(totalSlides.toString().padStart(2, "0"));

      // Update dots dynamically
      $dotsContainer.empty();
      for (let i = 0; i < totalSlides; i++) {
        const dotClass = i === 0 ? "dot active" : "dot";
        $dotsContainer.append(`<span class="${dotClass}"></span>`);
      }

      return totalSlides;
    }

    // Function to update progress
    function updateProgress(event) {
      const totalSlides = updateSliderMeta(); // Dynamically get total slides
      const currentIndex =
        event.item.index - event.relatedTarget._clones.length / 2 + 1; // Adjust for cloned slides
      const adjustedIndex = currentIndex > totalSlides ? 1 : currentIndex; // Handle looping properly

      const progressWidth = (adjustedIndex / totalSlides) * 100 + "%";

      // Update progress bar
      $progressBar.css("width", progressWidth);

      // Update slide numbers
      $currentSlide.text(adjustedIndex.toString().padStart(2, "0"));

      // Update dots
      const $dots = $dotsContainer.find(".dot");
      $dots
        .removeClass("active")
        .eq(adjustedIndex - 1)
        .addClass("active");
    }

    // Initialize Owl Carousel
    $carousel.owlCarousel({
      items: 1,
      loop: true,
      nav: false,
      dots: false,
      autoplay: true,
      margin: 12,
      autoplayHoverPause: true,
      animateOut: "fadeOut",
      animateIn: "fadeIn",
      onInitialized: updateProgress,
      onChanged: updateProgress,
    });

    // Custom dot navigation
    $dotsContainer.on("click", ".dot", function () {
      const index = $(this).index();
      $carousel.trigger("to.owl.carousel", [index, 300]);
    });

    // Handle dynamic slide updates
    updateSliderMeta(); // Initialize dots and metadata

    /*======================================================================================
      Portoflio Isotope JS
    =======================================================================================*/
    if ($("#isotop-gallery-wrapper").length) {
      var $grid = $("#isotop-gallery-wrapper").isotope({
        // options
        itemSelector: ".isotop-item",
        percentPosition: true,
        masonry: {
          // use element for option
          columnWidth: ".grid-sizer",
        },
      });

      // filter items on button click
      $(".isotop-menu-wrapper").on("click", "li", function () {
        var filterValue = $(this).attr("data-filter");
        $grid.isotope({ filter: filterValue });
      });

      // change is-checked class on buttons
      $(".isotop-menu-wrapper").each(function (i, buttonGroup) {
        var $buttonGroup = $(buttonGroup);
        $buttonGroup.on("click", "li", function () {
          $buttonGroup.find(".is-checked").removeClass("is-checked");
          $(this).addClass("is-checked");
        });
      });
    }

    // Section Animation
    gsap.registerPlugin(ScrollTrigger);

    // if (window.screen.width > 991) {
    //   // Pin a single element within a specified area
    //   if (document.querySelector(".pin__element")) {
    //     gsap.to(".pin__element", {
    //       scrollTrigger: {
    //         trigger: ".pin__area", // The container that defines the pin area
    //         pin: ".pin__element", // The element to pin
    //         start: "top top", // Start pinning when the top of the container reaches the top of the viewport
    //         end: "bottom bottom", // Stop pinning when the bottom of the container reaches the bottom of the viewport
    //         pinSpacing: false, // Removes extra space for pinning
    //       },
    //     });
    //   }

    //   // Pin multiple elements sequentially
    //   if (document.querySelector(".pin__elem")) {
    //     gsap.utils.toArray(".pin__elem").forEach((elem, index, array) => {
    //       // Do not pin the last element
    //       if (index !== array.length - 1) {
    //         ScrollTrigger.create({
    //           trigger: elem, // Each element to pin
    //           start: "top top", // Start pinning when its top reaches the top of the viewport
    //           pin: true, // Enable pinning
    //           pinSpacing: false, // Removes spacing
    //         });
    //       }
    //     });
    //   }
    // }

    // let mm = gsap.matchMedia();

    // mm.add("(min-width: 1024px)", () => {
    //   var pin_list = document.querySelectorAll(".section-item"); // Select all elements to be pinned
    //   pin_list.forEach((item) => {
    //     gsap.to(item, {
    //       scrollTrigger: {
    //         trigger: item, // Trigger each `.section-item`
    //         markers: false, // Disable visual markers for debugging
    //         pin: true, // Pin the element
    //         pinSpacing: false, // Disable extra space for pinned elements
    //         start: "bottom bottom", // Start pinning when the bottom of the element reaches the viewport bottom
    //         end: "bottom -=500", // Stop pinning 500px before the bottom of the element
    //       },
    //     });
    //   });
    // });

    let mm = gsap.matchMedia();

    mm.add("(min-width: 1024px)", () => {
      var pin_list = document.querySelectorAll(".section-item");

      pin_list.forEach((item) => {
        gsap.to(item, {
          scrollTrigger: {
            trigger: item,
            markers: false,
            pin: true,
            pinSpacing: false,
            start: "25% top",
            end: "bottom top",
            scrub: 1,
          },
        });
      });
    });

    /*======================================================================================
      Text Move JS
    =======================================================================================*/
    if (".text-move-slider") {
      var textMove = new Swiper(".text-move-slider", {
        slidesPerView: "auto",
        loop: true,
        autoplay: true,
        spaceBetween: 32,
        speed: 5000,
        autoplay: {
          delay: 1,
        },
      });
    }

    /*======================================================================================
      Testimonial Slider JS
    =======================================================================================*/
    $(".testimonial-slider").owlCarousel({
      items: 1,
      autoplay: true,
      loop: true,
      margin: 24,
      touchDrag: false,
      mouseDrag: true,
      autoplayTimeout: 5000,
      autoplayHoverPause: true,
      animateOut: "fadeOut",
      animateIn: "fadeIn",
      smartSpeed: 800,
      merge: true,
      dots: true,
      nav: false,
    });

    /*======================================================================================
      Testimonial Slider Two JS
    =======================================================================================*/
    $(".testimonial-slider-2").owlCarousel({
      items: 4,
      autoplay: false,
      loop: true,
      margin: 32,
      touchDrag: false,
      mouseDrag: true,
      autoWidth: true,
      autoplayTimeout: 5000,
      autoplayHoverPause: true,
      animateOut: "fadeOut",
      animateIn: "fadeIn",
      smartSpeed: 800,
      merge: true,
      dots: false,
      nav: true,
      navText: [
        "<i class='fi fi-rr-arrow-small-left'></i>",
        "<i class='fi fi-rr-arrow-small-right'></i>",
      ],
      responsive: {
        300: {
          items: 1,
          autoWidth: false,
        },
        768: {
          items: 2,
          autoWidth: false,
        },
        1024: {
          items: 3,
          autoWidth: false,
        },
        1200: {
          items: 4,
        },
      },
    });

    /*======================================================================================
      Testimonial Slider Three JS
    =======================================================================================*/
    $(".testimonial-slider-3").owlCarousel({
      items: 1,
      autoplay: true,
      loop: true,
      margin: 24,
      touchDrag: false,
      mouseDrag: true,
      autoplayTimeout: 5000,
      autoplayHoverPause: true,
      smartSpeed: 800,
      merge: true,
      dots: false,
      nav: true,
      navText: [
        "<i class='fi fi-rr-arrow-small-left'></i>",
        "<i class='fi fi-rr-arrow-small-right'></i>",
      ],
    });

    /*======================================================================================
      Portfolio Slider JS
    =======================================================================================*/
    $(".portfolio-slider").owlCarousel({
      items: 3,
      autoplay: true,
      loop: true,
      touchDrag: true,
      mouseDrag: true,
      autoplayTimeout: 5000,
      autoplayHoverPause: false,
      animateOut: "fadeOut",
      animateIn: "fadeIn",
      smartSpeed: 500,
      merge: true,
      dots: false,
      nav: false,
      margin: 30,
      responsive: {
        300: {
          items: 1,
        },
        480: {
          items: 1,
        },
        768: {
          items: 2,
        },
        1024: {
          items: 2,
        },
        1200: {
          items: 3,
        },
      },
    });

    /*======================================================================================
      Partners Slider Two JS
    =======================================================================================*/
    $(".portfolio-slider-2").owlCarousel({
      items: 4,
      autoplay: true,
      loop: true,
      touchDrag: true,
      mouseDrag: true,
      autoplayTimeout: 5000,
      autoplayHoverPause: false,
      animateOut: "fadeOut",
      animateIn: "fadeIn",
      smartSpeed: 500,
      merge: true,
      dots: false,
      nav: false,
      margin: 24,
      responsive: {
        300: {
          items: 1,
        },
        480: {
          items: 1,
        },
        768: {
          items: 2,
        },
        1024: {
          items: 3,
        },
        1200: {
          items: 4,
        },
      },
    });

    /*======================================================================================
      Partners Slider JS
    =======================================================================================*/
    $(".partner-slider").owlCarousel({
      items: 6,
      autoplay: true,
      loop: true,
      touchDrag: true,
      mouseDrag: true,
      autoplayTimeout: 5000,
      autoplayHoverPause: false,
      animateOut: "fadeOut",
      animateIn: "fadeIn",
      smartSpeed: 500,
      merge: true,
      dots: false,
      nav: false,
      margin: 30,
      responsive: {
        300: {
          items: 2,
          margin: 16,
        },
        480: {
          items: 2,
          margin: 16,
        },
        768: {
          items: 3,
        },
        1024: {
          items: 4,
        },
        1200: {
          items: 6,
        },
      },
    });
  });

  /*======================================================================================
    Custom Cursor JS
  =======================================================================================*/
  function gsap_custom_cursor() {
    var cursorBall = document.getElementById("cursor-ball");
    if (cursorBall) {
      let mouse = { x: 0, y: 0 };
      let pos = { x: 0, y: 0 };
      let ratio = 0.99;
      let active = false;
      gsap.set(cursorBall, {
        xPercent: -50,
        yPercent: -50,
        borderWidth: "1px",
        width: "40px",
        height: "40px",
      });
      document.addEventListener("mousemove", mouseMove);
      function mouseMove(e) {
        var scrollTop =
          window.pageYOffset || document.documentElement.scrollTop;
        mouse.x = e.pageX;
        mouse.y = e.pageY - scrollTop;
      }
      gsap.ticker.add(updatePosition);
      function updatePosition() {
        if (!active) {
          pos.x += (mouse.x - pos.x) * ratio;
          pos.y += (mouse.y - pos.y) * ratio;
          gsap.to(cursorBall, { duration: 0.4, x: pos.x, y: pos.y });
        }
      }

      // Common Area
      $("a, button, input[type=submit]").on("mouseenter", function (e) {
        gsap.to(cursorBall, {
          borderColor: "rgba(34, 34, 34, 0.05",
          scale: 1.7,
          opacity: 0.15,
          backgroundColor: "rgba(34, 34, 34, 0.2)",
        });
      });
      $("a, button, input[type=submit]").on("mouseleave", function (e) {
        gsap.to(cursorBall, {
          borderColor: "rgba(156, 156, 156, 0.5)",
          scale: 1,
          opacity: 1,
          backgroundColor: "transparent",
          width: "40px",
          height: "40px",
        });
        gsap.ticker.add(updatePosition);
      });
    }
  }
  gsap_custom_cursor();

  /*======================================================================================
    Smooth Scroll JS
  =======================================================================================*/
  function smoothSctoll() {
    $(".smooth a").on("click", function (event) {
      var target = $(this.getAttribute("href"));
      if (target.length) {
        event.preventDefault();
        $("html, body")
          .stop()
          .animate(
            {
              scrollTop: target.offset().top - 120,
            },
            1000
          );
      }
    });
  }

  smoothSctoll();

  if ($("#smooth-wrapper").length && $("#smooth-content").length) {
    gsap.registerPlugin(
      ScrollTrigger,
      ScrollSmoother,
      TweenMax,
      ScrollToPlugin
    );

    gsap.config({
      nullTargetWarn: false,
    });

    let smoother = ScrollSmoother.create({
      smooth: 0.5,
      effects: true,
      smoothTouch: 0.5,
      normalizeScroll: false,
      ignoreMobileResize: true,
    });
  }

  /*======================================================================================
    Preloader JS
  =======================================================================================*/
  var prealoaderOption = $(window);
  prealoaderOption.on("load", function () {
    var preloader = jQuery(".preloader");
    var preloaderArea = jQuery(".preloader");
    preloader.fadeOut();
    preloaderArea.delay(350).fadeOut("slow");
  });
})(jQuery);

var device_width = window.screen.width;

// Word Animation
document.addEventListener("DOMContentLoaded", function () {
  setTimeout(() => {
    TitleAnimationActive();
    gsap.delayedCall(0.5, () => ScrollTrigger.refresh()); // Refresh GSAP triggers after animations are applied
  }, 300); // Delay ensures elements are fully rendered before animation
});

function TitleAnimationActive() {
  let animationItems = document.querySelectorAll(".has_word_anim");

  animationItems.forEach((item) => {
    let stagger = item.getAttribute("data-stagger") || 0.04;
    let translateX = item.getAttribute("data-translateX") || 0;
    let translateY = item.getAttribute("data-translateY") || 0;
    let onScroll = item.getAttribute("data-on-scroll") || 1;
    let delay = item.getAttribute("data-delay") || 0.1;
    let duration = item.getAttribute("data-duration") || 0.75;

    let splitText = new SplitText(item, { type: "chars, words" });

    let animationProps = {
      duration: duration,
      delay: delay,
      x: translateX || 20, // Default X movement
      y: translateY || 0,
      autoAlpha: 0,
      stagger: stagger,
    };

    if (onScroll == 1) {
      animationProps.scrollTrigger = {
        trigger: item,
        start: "top 90%",
        end: "bottom 70%",
        toggleActions: "play none none none",
      };
    }

    gsap.from(splitText.words, animationProps);
  });
}

// Fade Animation
let fadeArray_items = document.querySelectorAll(".has_fade_anim");
if (fadeArray_items.length > 0) {
  fadeArray_items.forEach((item) => {
    let fade_direction = "bottom";
    let onscroll_value = 1;
    let duration_value = 1.15;
    let fade_offset = 50;
    let delay_value = 0.15;
    let ease_value = "power2.out";

    if (item.getAttribute("data-fade-offset")) {
      fade_offset = parseFloat(item.getAttribute("data-fade-offset"));
    }
    if (item.getAttribute("data-duration")) {
      duration_value = parseFloat(item.getAttribute("data-duration"));
    }
    if (item.getAttribute("data-fade-from")) {
      fade_direction = item.getAttribute("data-fade-from");
    }
    if (item.getAttribute("data-on-scroll")) {
      onscroll_value = parseInt(item.getAttribute("data-on-scroll"));
    }
    if (item.getAttribute("data-delay")) {
      delay_value = parseFloat(item.getAttribute("data-delay"));
    }
    if (item.getAttribute("data-ease")) {
      ease_value = item.getAttribute("data-ease");
    }

    let animation_settings = {
      opacity: 0,
      ease: ease_value,
      duration: duration_value,
      delay: delay_value,
    };

    if (fade_direction === "top") animation_settings.y = -fade_offset;
    if (fade_direction === "left") animation_settings.x = -fade_offset;
    if (fade_direction === "bottom") animation_settings.y = fade_offset;
    if (fade_direction === "right") animation_settings.x = fade_offset;

    if (onscroll_value === 1) {
      animation_settings.scrollTrigger = {
        trigger: item,
        start: "top 85%",
      };
    }

    gsap.from(item, animation_settings);
  });
}
